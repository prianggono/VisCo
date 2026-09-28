import { describe, expect, it } from "vitest";
import { sourceKindForDevice } from "../src/domain/device.js";
import { DeviceDiscoveryEngine, NativeVideoCaptureDiscoveryProvider } from "../src/engine/device-discovery.js";

describe("USB Video Capture", () => {
  it("maps video-capture devices to the dedicated source kind", () => {
    expect(sourceKindForDevice("video-capture")).toBe("video-capture");
  });

  it("keeps USB capture discovery behind the native provider", async () => {
    const engine = new DeviceDiscoveryEngine();
    const bridge = {
      discover: async () => [{
        id: "usb-capture-1",
        name: "USB HDMI Capture",
        kind: "video-capture" as const,
        transport: "local" as const,
        metadata: { backend: "windows-media-device", usb: true }
      }]
    };
    engine.register(new NativeVideoCaptureDiscoveryProvider(bridge));

    const result = await engine.discover({ kind: "video-capture" });

    expect(result.source).toBe("native");
    expect(result.devices[0]?.name).toBe("USB HDMI Capture");
    expect(result.devices[0]?.metadata?.usb).toBe(true);
  });
});
