import type { DeviceKind, DiscoveredDevice } from "../domain/device.js";
import type { VideoFrame } from "../domain/frame-source.js";
import type { WindowsVideoDevice, WindowsVideoDeviceBridge } from "./windows-video-device.js";

export interface WindowsVideoCaptureConfig {
  readonly device: DiscoveredDevice;
  readonly width?: number;
  readonly height?: number;
  readonly fps?: number;
}

export interface WindowsVideoCaptureStatus {
  readonly running: boolean;
  readonly connected: boolean;
  readonly frames: number;
  readonly error: string | null;
}

export interface WindowsVideoCaptureBridge extends WindowsVideoDeviceBridge {
  open(config: WindowsVideoCaptureConfig): Promise<void>;
  close(): Promise<void>;
  read(): Promise<VideoFrame | null>;
  getStatus(): WindowsVideoCaptureStatus;
}

export class WindowsVideoRuntime {
  private device: WindowsVideoDevice | null = null;
  private opened = false;

  constructor(private readonly bridge: WindowsVideoCaptureBridge) {}

  async select(kind: Extract<DeviceKind, "camera" | "video-capture">, deviceId: string): Promise<WindowsVideoDevice> {
    if (!deviceId.trim()) throw new Error("Video device id is required.");
    const devices = await this.bridge.enumerate(kind);
    const found = devices.find((item) => item.device.id === deviceId);
    if (!found) throw new Error(`Windows video device "${deviceId}" was not found.`);
    this.device = found;
    return found;
  }

  async open(config: WindowsVideoCaptureConfig): Promise<void> {
    if (!this.device || this.device.device.id !== config.device.id) this.device = config.device.id ? { device: config.device } : null;
    if (!this.device) throw new Error("A Windows video device must be selected before opening.");
    await this.bridge.open(config);
    this.opened = true;
  }

  async read(): Promise<VideoFrame | null> {
    if (!this.opened) throw new Error("Windows video capture is not open.");
    return this.bridge.read();
  }

  async close(): Promise<void> {
    if (!this.opened) return;
    try { await this.bridge.close(); } finally { this.opened = false; }
  }

  getStatus(): WindowsVideoCaptureStatus { return this.bridge.getStatus(); }
  getDevice(): WindowsVideoDevice | null { return this.device; }
}
