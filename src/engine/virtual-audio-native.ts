import type { VirtualAudioChannel, VirtualAudioEndpoint } from "../domain/virtual-audio.js";

export type NativeVirtualAudioStatus =
  | "unavailable"
  | "stopped"
  | "running"
  | "error";

export interface NativeVirtualAudioState {
  readonly channel: VirtualAudioChannel;
  readonly endpoint: VirtualAudioEndpoint;
  readonly status: NativeVirtualAudioStatus;
  readonly error?: string;
}

/**
 * IPC boundary between VisCo's platform-neutral engine and the future
 * Windows native implementation.
 *
 * No Windows API is referenced here. The desktop shell owns transport,
 * permissions and driver/service lifecycle.
 */
export interface NativeVirtualAudioBridge {
  getState(channel: VirtualAudioChannel): Promise<NativeVirtualAudioState>;
  start(channel: VirtualAudioChannel): Promise<NativeVirtualAudioState>;
  stop(channel: VirtualAudioChannel): Promise<NativeVirtualAudioState>;
  refresh(channel: VirtualAudioChannel): Promise<NativeVirtualAudioState>;
}

export class UnavailableNativeVirtualAudioBridge implements NativeVirtualAudioBridge {
  constructor(private readonly endpoints: ReadonlyMap<VirtualAudioChannel, VirtualAudioEndpoint>) {}

  async getState(channel: VirtualAudioChannel): Promise<NativeVirtualAudioState> {
    return this.state(channel);
  }

  async start(channel: VirtualAudioChannel): Promise<NativeVirtualAudioState> {
    return this.state(channel, "unavailable", "Windows native Virtual Audio backend is not installed.");
  }

  async stop(channel: VirtualAudioChannel): Promise<NativeVirtualAudioState> {
    return this.state(channel, "unavailable");
  }

  async refresh(channel: VirtualAudioChannel): Promise<NativeVirtualAudioState> {
    return this.state(channel);
  }

  private state(
    channel: VirtualAudioChannel,
    status: NativeVirtualAudioStatus = "unavailable",
    error?: string
  ): NativeVirtualAudioState {
    const endpoint = this.endpoints.get(channel);
    if (!endpoint) throw new Error(`Virtual Audio ${channel} is not configured.`);

    return { channel, endpoint, status, ...(error ? { error } : {}) };
  }
}
