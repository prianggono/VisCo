import type { DeviceKind, DiscoveredDevice } from "../domain/device.js";

export interface WindowsVideoDeviceCapabilities {
  readonly resolutions?: readonly [number, number][];
  readonly frameRates?: readonly number[];
  readonly pixelFormats?: readonly string[];
  readonly audioInput?: boolean;
}

export interface WindowsVideoDevice {
  readonly device: DiscoveredDevice;
  readonly symbolicLink?: string;
  readonly capabilities?: WindowsVideoDeviceCapabilities;
}

/**
 * Native Windows boundary for both webcams/cameras and USB video-capture cards.
 * The implementation is responsible for querying Windows media devices and
 * classifying the device; the UI must not guess from device names.
 */
export interface WindowsVideoDeviceBridge {
  enumerate(kind: Extract<DeviceKind, "camera" | "video-capture">): Promise<readonly WindowsVideoDevice[]>;
}
