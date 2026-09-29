import type { MediaDecodeBackend } from "../engine/media-pipeline.js";

export interface NativeMediaDecoderRequest {
  readonly uri: string;
  readonly backend: MediaDecodeBackend;
  readonly width?: number;
  readonly height?: number;
  readonly fps?: number;
}

export interface NativeMediaDecoderStatus {
  readonly opened: boolean;
  readonly playing: boolean;
  readonly durationMs: number | null;
  readonly positionMs: number;
  readonly error: string | null;
}

export interface NativeMediaDecoderBridge {
  open(request: NativeMediaDecoderRequest): Promise<void>;
  close(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  read(): Promise<{ readonly timestampUs: number; readonly width: number; readonly height: number; readonly format: "bgra8" | "rgba8" | "nv12" | "unknown"; readonly nativeHandle?: string } | null>;
  getStatus(): NativeMediaDecoderStatus;
}

export class NativeMediaDecoder {
  private opened = false;

  constructor(private readonly bridge: NativeMediaDecoderBridge) {}

  async open(request: NativeMediaDecoderRequest): Promise<void> {
    if (!request.uri.trim()) throw new Error("Media URI is required.");
    await this.bridge.open(request);
    this.opened = true;
  }
  async close(): Promise<void> {
    if (!this.opened) return;
    try { await this.bridge.close(); } finally { this.opened = false; }
  }
  async play(): Promise<void> { this.requireOpen(); return this.bridge.play(); }
  async pause(): Promise<void> { this.requireOpen(); return this.bridge.pause(); }
  async seek(positionMs: number): Promise<void> {
    this.requireOpen();
    if (!Number.isFinite(positionMs) || positionMs < 0) throw new Error("Seek position must be non-negative.");
    return this.bridge.seek(positionMs);
  }
  async read() { this.requireOpen(); return this.bridge.read(); }
  getStatus(): NativeMediaDecoderStatus { return this.bridge.getStatus(); }
  private requireOpen(): void { if (!this.opened) throw new Error("Media decoder is not open."); }
}
