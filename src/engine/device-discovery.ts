import type {
  DeviceDiscoveryRequest,
  DeviceDiscoveryResult,
  DiscoveredDevice,
  NativeDeviceDiscoveryBridge
} from "../domain/device.js";

export interface DeviceDiscoveryProvider {
  readonly id: string;
  readonly source: "native" | "browser" | "manual";
  supports(kind: DeviceDiscoveryRequest["kind"]): boolean;
  discover(request: DeviceDiscoveryRequest): Promise<readonly DiscoveredDevice[]>;
}

export class NativeDeviceDiscoveryProvider implements DeviceDiscoveryProvider {
  readonly id = "native-device-discovery";
  readonly source = "native" as const;

  constructor(private readonly bridge: NativeDeviceDiscoveryBridge) {}

  supports(): boolean {
    return true;
  }

  discover(request: DeviceDiscoveryRequest): Promise<readonly DiscoveredDevice[]> {
    return this.bridge.discover(request);
  }
}

/**
 * Browser discovery is deliberately limited to devices the browser can enumerate.
 * Network/video discovery remains a native responsibility.
 */
/**
 * USB video-capture discovery is intentionally native on Windows.
 * Browser enumerateDevices() is not used for this source because capture
 * cards should be handled by the Windows media-device backend.
 */
export class NativeCameraDiscoveryProvider implements DeviceDiscoveryProvider {
  readonly id = "native-camera-discovery";
  readonly source = "native" as const;

  constructor(private readonly bridge: NativeDeviceDiscoveryBridge) {}

  supports(kind: DeviceDiscoveryRequest["kind"]): boolean {
    return kind === "camera";
  }

  discover(request: DeviceDiscoveryRequest): Promise<readonly DiscoveredDevice[]> {
    return this.bridge.discover(request);
  }
}

export class NativeVideoCaptureDiscoveryProvider implements DeviceDiscoveryProvider {
  readonly id = "native-video-capture-discovery";
  readonly source = "native" as const;

  constructor(private readonly bridge: NativeDeviceDiscoveryBridge) {}

  supports(kind: DeviceDiscoveryRequest["kind"]): boolean {
    return kind === "video-capture";
  }

  discover(request: DeviceDiscoveryRequest): Promise<readonly DiscoveredDevice[]> {
    return this.bridge.discover(request);
  }
}

export class DeviceDiscoveryEngine {
  private readonly providers: DeviceDiscoveryProvider[] = [];

  register(provider: DeviceDiscoveryProvider): void {
    if (this.providers.some((item) => item.id === provider.id)) {
      throw new Error(`Device discovery provider "${provider.id}" is already registered.`);
    }
    this.providers.push(provider);
  }

  async discover(request: DeviceDiscoveryRequest): Promise<DeviceDiscoveryResult> {
    const provider = this.providers.find((item) => item.supports(request.kind));
    if (!provider) {
      return {
        kind: request.kind,
        devices: [],
        source: "unavailable",
        message: `No discovery provider is registered for ${request.kind}.`
      };
    }

    try {
      const devices = await provider.discover(request);
      return {
        kind: request.kind,
        devices,
        source: provider.source,
        message: devices.length ? undefined : `No ${request.kind} devices were discovered.`
      };
    } catch (error) {
      return {
        kind: request.kind,
        devices: [],
        source: provider.source,
        message: error instanceof Error ? error.message : "Device discovery failed."
      };
    }
  }
}
