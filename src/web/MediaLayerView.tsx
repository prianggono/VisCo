import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Layer } from "../domain/layer.js";
import type { Source } from "../domain/source.js";
import type { LayerRenderStyle } from "../engine/layer-renderer.js";
import { DocumentLayerView } from "./DocumentLayerView.js";

interface MediaLayerViewProps {
  layer: Layer;
  source?: Source;
  style: LayerRenderStyle;
  playing?: boolean;
  loop?: boolean;
  speed?: number;
  label: string;
  onDocumentPageChange?: (sourceId: string, page: number) => void;
}

export function MediaLayerView({
  layer,
  source,
  style,
  playing = false,
  loop = false,
  speed = 100,
  label,
  onDocumentPageChange
}: MediaLayerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaError, setMediaError] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (source?.kind !== "camera") {
      setCameraStream(null);
      return;
    }

    let cancelled = false;
    const requestedDeviceId = typeof source.metadata?.deviceId === "string"
      ? source.metadata.deviceId
      : undefined;

    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError(true);
      return;
    }

    const constraints: MediaStreamConstraints = {
      video: requestedDeviceId ? { deviceId: { exact: requestedDeviceId } } : true,
      audio: false
    };

    void navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setMediaError(false);
      setCameraStream(stream);
    }).catch(() => {
      if (!cancelled) {
        setCameraStream(null);
        setMediaError(true);
      }
    });

    return () => {
      cancelled = true;
      setCameraStream((current) => {
        current?.getTracks().forEach((track) => track.stop());
        return null;
      });
    };
  }, [source?.id, source?.kind, source?.metadata?.deviceId]);

  useEffect(() => {
    if (!videoRef.current || !cameraStream) return;
    videoRef.current.srcObject = cameraStream;
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraStream]);

  useEffect(() => {
    setMediaError(false);
  }, [source?.id, source?.uri, source?.kind]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || source?.kind === "camera") return;
    video.playbackRate = Math.max(0.01, speed / 100);
    if (playing) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [playing, speed, source?.uri, source?.kind]);

  const mediaStyle: CSSProperties = {
    ...style,
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "100%",
    height: "100%",
    display: "block",
    pointerEvents: "none"
  };

  if (!source) {
    return (
      <div style={{ ...mediaStyle, display: "grid", placeItems: "center", color: "#fff", fontSize: 14 }}>
        MISSING SOURCE
      </div>
    );
  }

  if ((source.kind === "powerpoint" || source.kind === "pdf") && source.uri) {
    return <DocumentLayerView layer={layer} source={source} style={mediaStyle} label={label} onPageChange={(page) => onDocumentPageChange?.(source.id, page)} />;
  }

  const missingUri = (source.kind === "video" || source.kind === "image") && !source.uri;
  if (missingUri || mediaError) {
    return (
      <div
        style={{ ...mediaStyle, display: "grid", placeItems: "center", color: "#fff", fontSize: 14 }}
        aria-label={layer.name}
      >
        MISSING MEDIA · {source.name || label}
      </div>
    );
  }

  if (source.kind === "camera") {
    return (
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        style={{ ...mediaStyle, objectFit: style.objectFit }}
        aria-label={layer.name}
      />
    );
  }

  if (source.kind === "video" && source.uri) {
    return (
      <video
        ref={videoRef}
        src={source.uri}
        muted
        playsInline
        loop={loop}
        preload="auto"
        onError={() => setMediaError(true)}
        style={{ ...mediaStyle, objectFit: style.objectFit }}
        aria-label={layer.name}
      />
    );
  }

  if (source.kind === "image" && source.uri) {
    return (
      <img
        src={source.uri}
        alt={layer.name}
        onError={() => setMediaError(true)}
        style={{ ...mediaStyle, objectFit: style.objectFit }}
      />
    );
  }

  if (source.kind === "colour") {
    return <div style={{ ...mediaStyle, background: "#ffffff" }} aria-label={layer.name} />;
  }

  return (
    <div style={{ ...mediaStyle, display: "grid", placeItems: "center", color: "#fff", fontSize: 14 }}>
      {source.name || label}
    </div>
  );
}
