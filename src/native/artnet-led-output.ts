import type { OutputFrame } from "../engine/output-frame.js";

export interface ArtNetLedOutputConfig {
  readonly id: string;
  readonly host: string;
  readonly port?: number;
  readonly universe: number;
  readonly channelOffset?: number;
}

export interface ArtNetFrame {
  readonly universe: number;
  readonly channels: Uint8Array;
}

export interface ArtNetLedOutputStatus {
  readonly connected: boolean;
  readonly error: string | null;
}

export interface ArtNetLedOutputBridge {
  connect(config: ArtNetLedOutputConfig): Promise<void>;
  disconnect(): Promise<void>;
  send(frame: ArtNetFrame): Promise<void>;
  getStatus(): ArtNetLedOutputStatus;
}

/** VisCo LED transport is intentionally limited to Art-Net. HDMI/display outputs use display transport. */
export class ArtNetLedOutput {
  readonly kind = "art-net" as const;

  constructor(private readonly config: ArtNetLedOutputConfig, private readonly bridge: ArtNetLedOutputBridge) {}

  connect(): Promise<void> { return this.bridge.connect(this.config); }
  disconnect(): Promise<void> { return this.bridge.disconnect(); }

  send(frame: ArtNetFrame): Promise<void> {
    if (frame.universe < 0 || frame.universe > 32767) throw new Error("Art-Net universe must be between 0 and 32767.");
    if (frame.channels.length > 512) throw new Error("Art-Net DMX payload cannot exceed 512 channels.");
    return this.bridge.send(frame);
  }

  getStatus(): ArtNetLedOutputStatus { return this.bridge.getStatus(); }
}

export function createArtNetFrame(universe: number, channels: Uint8Array): ArtNetFrame {
  return { universe, channels };
}

export type ArtNetSourceFrame = OutputFrame;