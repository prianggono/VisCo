import type { DiscoveredDevice } from "../domain/device.js";
import type { FrameSource, FrameSourceStatus, VideoFrame } from "../domain/frame-source.js";
import type { FrameSourceProvider } from "./frame-pipeline.js";

export interface FrameSourceManagerStatus {
  readonly deviceId: string;
  readonly sourceId: string | null;
  readonly running: boolean;
  readonly available: boolean;
  readonly error: string | null;
}

export class ResilientFrameSourceManager {
  private source: FrameSource | null = null;
  private device: DiscoveredDevice | null = null;
  private error: string | null = null;

  constructor(private readonly providers: readonly FrameSourceProvider[]) {}

  async attach(device: DiscoveredDevice): Promise<FrameSourceManagerStatus> {
    this.device = device;
    this.error = null;
    const provider = this.providers.find((item) => item.supports(device));
    if (!provider) {
      this.source = null;
      this.error = `No frame source provider is registered for device "${device.id}".`;
      return this.getStatus();
    }
    try {
      this.source = await provider.create(device);
      return this.getStatus();
    } catch (error) {
      this.source = null;
      this.error = error instanceof Error ? error.message : "Frame source creation failed.";
      return this.getStatus();
    }
  }

  async start(request?: { readonly width?: number; readonly height?: number; readonly fps?: number }): Promise<FrameSourceManagerStatus> {
    if (!this.source) return this.getStatus();
    try {
      await this.source.start(request);
      this.error = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Frame source start failed.";
    }
    return this.getStatus();
  }

  async stop(): Promise<FrameSourceManagerStatus> {
    if (!this.source) return this.getStatus();
    try {
      await this.source.stop();
      this.error = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Frame source stop failed.";
    }
    return this.getStatus();
  }

  subscribe(listener: (frame: VideoFrame) => void): () => void {
    return this.source ? this.source.subscribe(listener) : () => undefined;
  }

  async retry(): Promise<FrameSourceManagerStatus> {
    if (!this.device) return this.getStatus();
    return this.attach(this.device);
  }

  getStatus(): FrameSourceManagerStatus {
    const sourceStatus: FrameSourceStatus | null = this.source?.getStatus() ?? null;
    return {
      deviceId: this.device?.id ?? "",
      sourceId: this.source?.id ?? null,
      running: sourceStatus?.running ?? false,
      available: this.source !== null,
      error: this.error ?? sourceStatus?.error ?? null
    };
  }
}
