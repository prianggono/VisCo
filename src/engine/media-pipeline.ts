export type MediaDecodeBackend = "media-foundation" | "ffmpeg-compatibility";
export type CaptureBackend = "directshow" | "native-professional";

export interface MediaPipelineCapabilities {
  readonly primaryDecode: "media-foundation";
  readonly compatibilityDecode: "ffmpeg-compatibility";
  readonly captureFallback: "directshow";
  readonly professionalCapture: "native-professional";
}

export interface MediaPipelineRequest {
  readonly uri: string;
  readonly preferredBackend?: MediaDecodeBackend;
}

export interface MediaPipelineSession {
  readonly backend: MediaDecodeBackend;
  readonly uri: string;
  readonly playable: boolean;
  readonly compatibilityRequired: boolean;
}

/**
 * Canonical Windows media policy. Native Media Foundation is preferred;
 * FFmpeg compatibility is a fallback so unsupported media does not crash.
 */
export function chooseMediaBackend(request: MediaPipelineRequest): MediaDecodeBackend {
  return request.preferredBackend ?? "media-foundation";
}

export function createMediaPipelineSession(request: MediaPipelineRequest, nativeSupported: boolean): MediaPipelineSession {
  const backend = nativeSupported ? chooseMediaBackend(request) : "ffmpeg-compatibility";
  return {
    backend,
    uri: request.uri,
    playable: true,
    compatibilityRequired: backend === "ffmpeg-compatibility"
  };
}

export const MEDIA_PIPELINE_CAPABILITIES: MediaPipelineCapabilities = {
  primaryDecode: "media-foundation",
  compatibilityDecode: "ffmpeg-compatibility",
  captureFallback: "directshow",
  professionalCapture: "native-professional"
};
