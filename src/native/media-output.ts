export type MediaOutputKind = "stream" | "record" | "virtual";

export interface MediaOutputConfig {
  readonly id: string;
  readonly kind: MediaOutputKind;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly bitrateKbps?: number;
  readonly codec?: string;
  readonly container?: string;
  readonly destination?: string;
}

export interface MediaOutputStatus {
  readonly connected: boolean;
  readonly running: boolean;
  readonly frames: number;
  readonly error: string | null;
}

export interface MediaOutputBridge {
  connect(config: MediaOutputConfig): Promise<void>;
  disconnect(): Promise<void>;
  submit(frame: { readonly width: number; readonly height: number; readonly frameNumber: number; readonly compositionId: string }): Promise<void>;
  getStatus(): MediaOutputStatus;
}

export class WindowsMediaOutput {
  constructor(private readonly config: MediaOutputConfig, private readonly bridge: MediaOutputBridge) {
    validateMediaOutputConfig(config);
  }
  connect(): Promise<void> { return this.bridge.connect(this.config); }
  disconnect(): Promise<void> { return this.bridge.disconnect(); }
  submit(frame: { readonly width: number; readonly height: number; readonly frameNumber: number; readonly compositionId: string }): Promise<void> {
    if (frame.width <= 0 || frame.height <= 0 || frame.frameNumber < 0 || !frame.compositionId.trim()) {
      throw new Error("Invalid media output frame.");
    }
    return this.bridge.submit(frame);
  }
  getStatus(): MediaOutputStatus { return this.bridge.getStatus(); }
}

export function validateMediaOutputConfig(config: MediaOutputConfig): void {
  if (!config.id.trim()) throw new Error("Media output id is required.");
  if (!Number.isInteger(config.width) || config.width <= 0) throw new Error("Media output width must be a positive integer.");
  if (!Number.isInteger(config.height) || config.height <= 0) throw new Error("Media output height must be a positive integer.");
  if (!Number.isFinite(config.fps) || config.fps <= 0 || config.fps > 120) throw new Error("Media output FPS must be between 1 and 120.");
  if (config.bitrateKbps !== undefined && (!Number.isFinite(config.bitrateKbps) || config.bitrateKbps <= 0)) throw new Error("Media output bitrate must be positive.");
  if (config.destination !== undefined && !config.destination.trim()) throw new Error("Media output destination cannot be empty.");
}
