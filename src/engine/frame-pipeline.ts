import type { DiscoveredDevice } from "../domain/device.js";
import type { FrameSource, NativeFrameSourceBridge } from "../domain/frame-source.js";

export interface FrameSourceProvider {
  readonly id: string;
  supports(device: DiscoveredDevice): boolean;
  create(device: DiscoveredDevice): Promise<FrameSource>;
}

export class NativeFrameSourceProvider implements FrameSourceProvider {
  readonly id = "native-frame-source";

  constructor(private readonly bridge: NativeFrameSourceBridge) {}

  supports(): boolean {
    return true;
  }

  create(device: DiscoveredDevice): Promise<FrameSource> {
    return this.bridge.createSource({ device });
  }
}

export class FramePipeline {
  private readonly providers: FrameSourceProvider[] = [];

  register(provider: FrameSourceProvider): void {
    if (this.providers.some((item) => item.id === provider.id)) {
      throw new Error(`Frame source provider "${provider.id}" is already registered.`);
    }
    this.providers.push(provider);
  }

  async create(device: DiscoveredDevice): Promise<FrameSource> {
    const provider = this.providers.find((item) => item.supports(device));
    if (!provider) {
      throw new Error(`No frame source provider is registered for device "${device.id}".`);
    }
    return provider.create(device);
  }
}
