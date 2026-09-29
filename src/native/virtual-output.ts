import type { OutputFrame } from "../engine/output-frame.js";

export interface VirtualOutputConfig {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly name: string;
}

export interface VirtualOutputStatus {
  readonly connected: boolean;
  readonly running: boolean;
  readonly error: string | null;
}

export interface VirtualOutputBridge {
  connect(config: VirtualOutputConfig): Promise<void>;
  disconnect(): Promise<void>;
  submit(frame: OutputFrame): Promise<void>;
  getStatus(): VirtualOutputStatus;
}

export class VirtualOutput {
  constructor(private readonly config: VirtualOutputConfig, private readonly bridge: VirtualOutputBridge) {
    if (!config.id.trim() || !config.name.trim()) throw new Error("Virtual output id and name are required.");
    if (!Number.isInteger(config.width) || config.width <= 0 || !Number.isInteger(config.height) || config.height <= 0) {
      throw new Error("Virtual output dimensions must be positive integers.");
    }
    if (!Number.isFinite(config.fps) || config.fps <= 0 || config.fps > 120) throw new Error("Virtual output FPS is invalid.");
  }
  connect(): Promise<void> { return this.bridge.connect(this.config); }
  disconnect(): Promise<void> { return this.bridge.disconnect(); }
  submit(frame: OutputFrame): Promise<void> { return this.bridge.submit(frame); }
  getStatus(): VirtualOutputStatus { return this.bridge.getStatus(); }
}
