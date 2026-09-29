import type { DeviceDiscoveryRequest, DiscoveredDevice, NativeDeviceDiscoveryBridge } from "../domain/device.js";

export interface NativeHostStatus {
  readonly available: boolean;
  readonly version?: string;
  readonly message?: string;
}

export interface NativeCaptureStatus {
  readonly ok: boolean;
  readonly running: boolean;
  readonly device?: string;
  readonly message?: string;
}

export interface NativeNetworkSource {
  readonly id: string;
  readonly name: string;
  readonly kind: "ndi" | "omt";
  readonly transport: "network";
  readonly address: string;
}

export interface NativeNetworkStatus {
  readonly running: boolean;
  readonly protocol: "none" | "ndi" | "omt";
  readonly error: string;
}

export interface NativeAsioDriver {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly clsid: string;
}

export interface NativeAsioStartResult {
  readonly ok: boolean;
  readonly running: boolean;
  readonly driver?: string;
  readonly sampleRate?: number;
  readonly channels?: number;
  readonly bufferFrames?: number;
  readonly message?: string;
}

export interface NativeAsioStatus {
  readonly running: boolean;
  readonly sampleRate: number;
  readonly channels: number;
  readonly bufferFrames: number;
  readonly callbackBlocks: number;
  readonly callbackFrames: number;
  readonly droppedFrames: number;
  readonly overruns: number;
  readonly availableFrames: number;
}

export interface NativeRuntimeAdapterStatus {
  readonly name: "NDI" | "OMT" | "ASIO";
  readonly available: boolean;
  readonly library: string;
  readonly message: string;
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

  async startCapture(deviceId: string): Promise<NativeCaptureStatus> {
    const response = await fetch(`${this.baseUrl}/capture/start?device=${encodeURIComponent(deviceId)}`, { cache: "no-store" });
    return await response.json() as NativeCaptureStatus;
  }

  async stopCapture(): Promise<NativeCaptureStatus> {
    const response = await fetch(`${this.baseUrl}/capture/stop`, { cache: "no-store" });
    return await response.json() as NativeCaptureStatus;
  }

  async discoverNetwork(protocol: "ndi" | "omt"): Promise<readonly NativeNetworkSource[]> {
    const response = await fetch(`${this.baseUrl}/network/discover?protocol=${encodeURIComponent(protocol)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Native network discovery failed (${response.status}).`);
    const payload = await response.json() as { devices?: NativeNetworkSource[]; message?: string };
    if (!Array.isArray(payload.devices)) throw new Error(payload.message ?? "Invalid native network discovery response.");
    return payload.devices;
  }

  async startNetwork(protocol: "ndi" | "omt", source: string): Promise<{ readonly ok: boolean; readonly running: boolean; readonly protocol?: string; readonly source?: string; readonly message?: string }> {
    const response = await fetch(`${this.baseUrl}/network/start?protocol=${encodeURIComponent(protocol)}&source=${encodeURIComponent(source)}`, { cache: "no-store" });
    return await response.json() as { ok: boolean; running: boolean; protocol?: string; source?: string; message?: string };
  }

  async stopNetwork(): Promise<{ readonly ok: boolean; readonly running: boolean }> {
    const response = await fetch(`${this.baseUrl}/network/stop`, { cache: "no-store" });
    return await response.json() as { ok: boolean; running: boolean };
  }

  async networkStatus(): Promise<NativeNetworkStatus> {
    const response = await fetch(`${this.baseUrl}/network/status`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Native network status failed (${response.status}).`);
    return await response.json() as NativeNetworkStatus;
  }

  async asioDrivers(): Promise<readonly NativeAsioDriver[]> {
    const response = await fetch(`${this.baseUrl}/asio/drivers`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Native ASIO driver enumeration failed (${response.status}).`);
    const payload = await response.json() as { drivers?: NativeAsioDriver[] };
    return payload.drivers ?? [];
  }

  async asioStart(driver: string): Promise<NativeAsioStartResult> {
    const response = await fetch(`${this.baseUrl}/asio/start?driver=${encodeURIComponent(driver)}`, { cache: "no-store" });
    const payload = await response.json() as NativeAsioStartResult;
    if (!response.ok || !payload.ok) throw new Error(payload.message ?? `Native ASIO start failed (${response.status}).`);
    return payload;
  }

  async asioStop(): Promise<{ readonly ok: boolean; readonly running: boolean }> {
    const response = await fetch(`${this.baseUrl}/asio/stop`, { cache: "no-store" });
    return await response.json() as { ok: boolean; running: boolean };
  }

  async asioStatus(): Promise<NativeAsioStatus> {
    const response = await fetch(`${this.baseUrl}/asio/status`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Native ASIO status failed (${response.status}).`);
    return await response.json() as NativeAsioStatus;
  }

  async runtimeAdapters(): Promise<readonly NativeRuntimeAdapterStatus[]> {
    const response = await fetch(`${this.baseUrl}/runtime`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Native runtime status failed (${response.status}).`);
    const payload = await response.json() as { adapters?: NativeRuntimeAdapterStatus[] };
    return payload.adapters ?? [];
  }
}
