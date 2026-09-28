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
export interface CapturePipelineRequest {
  readonly deviceId: string;
  readonly preferredBackend?: CaptureBackend;
}
export interface CapturePipelineSession {
  readonly backend: CaptureBackend;
  readonly deviceId: string;
}

export function chooseMediaBackend(request: MediaPipelineRequest): MediaDecodeBackend {
  return request.preferredBackend ?? "media-foundation";
}

export function createMediaPipelineSession(request: MediaPipelineRequest, nativeSupported: boolean): MediaPipelineSession {
  if (!request.uri.trim()) throw new Error("Media URI is required.");
  const backend = nativeSupported ? chooseMediaBackend(request) : "ffmpeg-compatibility";
  return { backend, uri: request.uri, playable: true, compatibilityRequired: backend === "ffmpeg-compatibility" };
}

/** Capture policy: professional native capture is explicit; DirectShow is the Windows fallback. */
export function createCapturePipelineSession(request: CapturePipelineRequest, professionalSupported: boolean): CapturePipelineSession {
  if (!request.deviceId.trim()) throw new Error("Capture device id is required.");
  const backend = professionalSupported && (request.preferredBackend ?? "native-professional") === "native-professional"
    ? "native-professional"
    : "directshow";
  return { backend, deviceId: request.deviceId };
}

export const MEDIA_PIPELINE_CAPABILITIES: MediaPipelineCapabilities = {
  primaryDecode: "media-foundation",
  compatibilityDecode: "ffmpeg-compatibility",
  captureFallback: "directshow",
  professionalCapture: "native-professional"
};
