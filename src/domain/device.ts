import type { SourceKind } from "./source.js";

export type DeviceKind =
  | "camera"
  | "video-capture"
  | "ndi"
  | "omt"
  | "ip-camera"
  | "desktop-capture"
  | "display"
  | "led";

export type DeviceTransport = "local" | "network" | "virtual";

export interface DiscoveredDevice {
  readonly id: string;
  readonly name: string;
  readonly kind: DeviceKind;
  readonly transport: DeviceTransport;
  readonly uri?: string;
  readonly address?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DeviceDiscoveryRequest {
  readonly kind: DeviceKind;
  readonly query?: string;
  /** NDI/OMT discovery-server address. The native adapter owns protocol details. */
  readonly discoveryServer?: string;
}

export type DeviceDiscoverySource = "native" | "browser" | "manual" | "unavailable";

export interface DeviceDiscoveryResult {
  readonly kind: DeviceKind;
  readonly devices: readonly DiscoveredDevice[];
  readonly source: DeviceDiscoverySource;
  readonly message?: string;
}

export interface NativeDeviceDiscoveryBridge {
  discover(request: DeviceDiscoveryRequest): Promise<readonly DiscoveredDevice[]>;
}

export function sourceKindForDevice(kind: DeviceKind): SourceKind {
  switch (kind) {
    case "ndi":
      return "ndi";
    case "omt":
      return "omt";
    case "ip-camera":
      return "ip-camera";
    case "desktop-capture":
      return "desktop-capture";
    case "camera":
      return "camera";
    case "video-capture":
      return "video-capture";
    default:
      throw new Error(`Device "${kind}" is not a Library Source.`);
  }
}
