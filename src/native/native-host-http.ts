import type { DeviceDiscoveryRequest, DiscoveredDevice, NativeDeviceDiscoveryBridge } from "../domain/device.js";

export interface NativeHostStatus {
  readonly available: boolean;
  readonly version?: string;
  readonly message?: string;
}

export class NativeHostHttpBridge implements NativeDeviceDiscoveryBridge {
  constructor(private readonly baseUrl = "http://127.0.0.1:47821") {}

  async status(): Promise<NativeHostStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) throw new Error(`Native host HTTP ${response.status}`);
      return await response.json() as NativeHostStatus;
    } catch (error) {
      return { available: false, message: error instanceof Error ? error.message : "Native host unavailable." };
    }
  }

  async discover(request: DeviceDiscoveryRequest): Promise<readonly DiscoveredDevice[]> {
    const params = new URLSearchParams({ kind: request.kind });
    if (request.query) params.set("query", request.query);
    if (request.discoveryServer) params.set("discoveryServer", request.discoveryServer);
    const response = await fetch(`${this.baseUrl}/devices?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Native host discovery failed (${response.status}).`);
    const payload = await response.json() as { devices?: DiscoveredDevice[]; message?: string };
    if (!Array.isArray(payload.devices)) throw new Error(payload.message ?? "Invalid native discovery response.");
    return payload.devices;
  }
}


export interface NativeCaptureStatus {
  readonly ok: boolean;
  readonly running: boolean;
  readonly device?: string;
  readonly message?: string;
}

export interface NativeRuntimeAdapterStatus {
  readonly name: "NDI" | "OMT" | "ASIO";
  readonly available: boolean;
  readonly library: string;
  readonly message: string;
  async startCapture(deviceId: string): Promise<NativeCaptureStatus> {
    const response = await fetch(`${this.baseUrl}/capture/start?device=${encodeURIComponent(deviceId)}`, { cache: "no-store" });
    return await response.json() as NativeCaptureStatus;
  }

  async stopCapture(): Promise<NativeCaptureStatus> {
    const response = await fetch(`${this.baseUrl}/capture/stop`, { cache: "no-store" });
    return await response.json() as NativeCaptureStatus;
  }

  async runtimeAdapters(): Promise<readonly NativeRuntimeAdapterStatus[]> {
    const response = await fetch(`${this.baseUrl}/runtime`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Native runtime status failed (${response.status}).`);
    const payload = await response.json() as { adapters?: NativeRuntimeAdapterStatus[] };
    return payload.adapters ?? [];
  }
}
