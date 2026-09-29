import type { DeviceKind, DiscoveredDevice } from "../domain/device.js";
import type { FrameSource, VideoFrame } from "../domain/frame-source.js";

export type NetworkFrameProtocol = Extract<DeviceKind, "ndi" | "omt" | "ip-camera">;

export interface NetworkFrameSourceBridge {
  create(device: DiscoveredDevice): Promise<FrameSource>;
  probe(device: DiscoveredDevice): Promise<{ readonly available: boolean; readonly message?: string }>;
}

export class NativeNetworkFrameSource {
  constructor(private readonly bridge: NetworkFrameSourceBridge) {}

  supports(device: DiscoveredDevice): boolean {
    return device.kind === "ndi" || device.kind === "omt" || device.kind === "ip-camera";
  }

  async probe(device: DiscoveredDevice) {
    if (!this.supports(device)) throw new Error(`Unsupported network source kind "${device.kind}".`);
    return this.bridge.probe(device);
  }

  async create(device: DiscoveredDevice): Promise<FrameSource> {
    if (!this.supports(device)) throw new Error(`Unsupported network source kind "${device.kind}".`);
    return this.bridge.create(device);
  }
}
