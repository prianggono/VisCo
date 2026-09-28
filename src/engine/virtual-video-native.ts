import type { CompositionFormat } from "../domain/composition.js";

export type NativeVirtualVideoStatus =
  | "unavailable"
  | "stopped"
  | "running"
  | "error";

export interface NativeVirtualVideoState {
  readonly deviceId: string;
  readonly name: string;
  readonly status: NativeVirtualVideoStatus;
  readonly format?: CompositionFormat;
  readonly error?: string;
}

/**
 * IPC boundary for the future Windows virtual camera/video device.
 * The native desktop shell owns driver registration and lifecycle.
 */
export interface NativeVirtualVideoBridge {
  getState(): Promise<NativeVirtualVideoState>;
  start(format: CompositionFormat): Promise<NativeVirtualVideoState>;
  stop(): Promise<NativeVirtualVideoState>;
  refresh(): Promise<NativeVirtualVideoState>;
}

export class UnavailableNativeVirtualVideoBridge implements NativeVirtualVideoBridge {
  constructor(
    private readonly deviceId = "visco-virtual-video",
    private readonly name = "VisCo Virtual Video"
  ) {}

  async getState(): Promise<NativeVirtualVideoState> {
    return this.state();
  }

  async start(format: CompositionFormat): Promise<NativeVirtualVideoState> {
    return {
      ...this.state("unavailable", "Windows native Virtual Video backend is not installed."),
      format
    };
  }

  async stop(): Promise<NativeVirtualVideoState> {
    return this.state("unavailable");
  }

  async refresh(): Promise<NativeVirtualVideoState> {
    return this.state();
  }

  private state(
    status: NativeVirtualVideoStatus = "unavailable",
    error?: string
  ): NativeVirtualVideoState {
    return {
      deviceId: this.deviceId,
      name: this.name,
      status,
      ...(error ? { error } : {})
    };
  }
}
