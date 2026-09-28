import type { CompositionFormat } from "../domain/composition.js";
import type { NativeVirtualVideoBridge, NativeVirtualVideoState } from "./virtual-video-native.js";

export class VirtualVideoEngine {
  constructor(private readonly bridge: NativeVirtualVideoBridge) {}

  async getState(): Promise<NativeVirtualVideoState> {
    return this.bridge.getState();
  }

  async start(format: CompositionFormat): Promise<NativeVirtualVideoState> {
    return this.bridge.start(format);
  }

  async stop(): Promise<NativeVirtualVideoState> {
    return this.bridge.stop();
  }

  async refresh(): Promise<NativeVirtualVideoState> {
    return this.bridge.refresh();
  }
}
