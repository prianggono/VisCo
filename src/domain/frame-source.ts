import type { DiscoveredDevice } from "../domain/device.js";

export type FramePixelFormat = "bgra8" | "rgba8" | "nv12" | "unknown";

export interface VideoFrame {
  readonly timestampUs: number;
  readonly width: number;
  readonly height: number;
  readonly format: FramePixelFormat;
  readonly data?: ArrayBuffer;
  readonly nativeHandle?: string;
}

export interface FrameSourceRequest {
  readonly device: DiscoveredDevice;
  readonly width?: number;
  readonly height?: number;
  readonly fps?: number;
}

export interface FrameSourceStatus {
  readonly id: string;
  readonly running: boolean;
  readonly frameCount: number;
  readonly lastFrameTimestampUs: number | null;
  readonly error?: string;
}

export interface FrameSource {
  readonly id: string;
  readonly device: DiscoveredDevice;
  start(request?: Omit<FrameSourceRequest, "device">): Promise<void>;
  stop(): Promise<void>;
  getStatus(): FrameSourceStatus;
  subscribe(listener: (frame: VideoFrame) => void): () => void;
}

export interface NativeFrameSourceBridge {
  createSource(request: FrameSourceRequest): Promise<FrameSource>;
}

/**
 * Boundary between device discovery and the Program renderer.
 * Protocol/capture implementation belongs to native adapters, never the React UI.
 */
export interface NativeFramePipeline {
  create(device: DiscoveredDevice): Promise<FrameSource>;
}
