import { useEffect, useRef } from "react";
import type { Layer } from "../domain/layer.js";
import type { Source } from "../domain/source.js";
import type { LayerRenderStyle } from "../engine/layer-renderer.js";

interface MediaLayerViewProps {
  layer: Layer;
  source?: Source;
  style: LayerRenderStyle;
  playing?: boolean;
  loop?: boolean;
  speed?: number;
  label: string;
}

const frameStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "contain",
  background: "transparent"
};

export function MediaLayerView({
  layer,
  source,
  style,
  playing = false,
  loop = false,
  speed = 100,
  label
}: MediaLayerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = Math.max(0.01, speed / 100);
    if (playing) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [playing, speed, source?.uri]);

  const mediaStyle: React.CSSProperties = {
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
    return <div style={{ ...mediaStyle, display: "grid", placeItems: "center" }}>{label}</div>;
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
        style={{ ...mediaStyle, objectFit: "contain" }}
        aria-label={layer.name}
      />
    );
  }

  if (source.kind === "image" && source.uri) {
    return <img src={source.uri} alt={layer.name} style={{ ...mediaStyle, objectFit: "contain" }} />;
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
