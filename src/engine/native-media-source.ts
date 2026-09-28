import type { Source } from "../domain/source.js";

export type NativeMediaProtocol =
  | "ndi"
  | "omt"
  | "ip-camera"
  | "desktop-capture";

export type NativeMediaSourceStatus =
  | "unavailable"
  | "stopped"
  | "starting"
  | "running"
  | "error";

export interface NativeVideoFormat {
  readonly width: number;
  readonly height: number;
  readonly frameRate?: number;
  readonly pixelFormat?: string;
}

export interface NativeMediaFrame {
  readonly timestamp: number;
  readonly duration?: number;
  readonly format: NativeVideoFormat;
  readonly video: ArrayBuffer | SharedArrayBuffer;
  readonly audio?: ArrayBuffer | SharedArrayBuffer;
}

export interface NativeMediaSourceState {
  readonly sourceId: string;
  readonly protocol: NativeMediaProtocol;
  readonly status: NativeMediaSourceStatus;
  readonly name?: string;
  readonly format?: NativeVideoFormat;
  readonly error?: string;
}

export interface NativeMediaSourceDescriptor {
  readonly sourceId: string;
  readonly protocol: NativeMediaProtocol;
  readonly name: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NativeMediaSourceBridge {
  getState(sourceId: string): Promise<NativeMediaSourceState>;
  start(source: NativeMediaSourceDescriptor): Promise<NativeMediaSourceState>;
  stop(sourceId: string): Promise<NativeMediaSourceState>;
  refresh(sourceId?: string): Promise<readonly NativeMediaSourceState[]>;
  readFrame(sourceId: string): Promise<NativeMediaFrame | null>;
}

export function protocolForSource(source: Pick<Source, "kind">): NativeMediaProtocol | undefined {
  switch (source.kind) {
    case "ndi":
      return "ndi";
    case "ip-camera":
      return "ip-camera";
    case "desktop-capture":
      return "desktop-capture";
    default:
      return undefined;
  }
}

export class UnavailableNativeMediaSourceBridge implements NativeMediaSourceBridge {
  private readonly states = new Map<string, NativeMediaSourceState>();

  async getState(sourceId: string): Promise<NativeMediaSourceState> {
    return this.states.get(sourceId) ?? {
      sourceId,
      protocol: "ndi",
      status: "unavailable",
      error: "Windows native media backend is not installed."
    };
  }

  async start(source: NativeMediaSourceDescriptor): Promise<NativeMediaSourceState> {
    const state: NativeMediaSourceState = {
      sourceId: source.sourceId,
      protocol: source.protocol,
      status: "unavailable",
      name: source.name,
      error: "Windows native media backend is not installed."
    };
    this.states.set(source.sourceId, state);
    return state;
  }

  async stop(sourceId: string): Promise<NativeMediaSourceState> {
    const current = this.states.get(sourceId);
    const state: NativeMediaSourceState = {
      sourceId,
      protocol: current?.protocol ?? "ndi",
      status: "unavailable",
      ...(current?.name ? { name: current.name } : {}),
      error: "Windows native media backend is not installed."
    };
    this.states.set(sourceId, state);
    return state;
  }

  async refresh(sourceId?: string): Promise<readonly NativeMediaSourceState[]> {
    if (sourceId) return [await this.getState(sourceId)];
    return [...this.states.values()];
  }

  async readFrame(sourceId: string): Promise<NativeMediaFrame | null> {
    await this.getState(sourceId);
    return null;
  }
}
