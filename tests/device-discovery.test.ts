import { describe, expect, it } from "vitest";
import { DeviceDiscoveryEngine, NativeDeviceDiscoveryProvider } from "../src/engine/device-discovery.js";
import type { DiscoveredDevice, DeviceDiscoveryRequest } from "../src/domain/device.js";

describe("DeviceDiscoveryEngine", () => {
  it("returns unavailable when no provider owns the requested device kind", async () => {
    const engine = new DeviceDiscoveryEngine();
    const result = await engine.discover({ kind: "ndi" });

    expect(result.source).toBe("unavailable");
    expect(result.devices).toEqual([]);
  });

  it("routes NDI/OMT discovery to the native bridge without protocol logic in the UI", async () => {
    const requests: DeviceDiscoveryRequest[] = [];
    const device: DiscoveredDevice = {
      id: "omt-1",
      name: "Stage OMT",
      kind: "omt",
      transport: "network",
      address: "192.168.1.20:6400"
    };

    const engine = new DeviceDiscoveryEngine();
    engine.register(new NativeDeviceDiscoveryProvider({
      discover: async (request) => {
        requests.push(request);
        return [device];
      }
    }));

    const result = await engine.discover({
      kind: "omt",
      discoveryServer: "192.168.1.10:6399"
    });

    expect(requests[0]).toEqual({
      kind: "omt",
      discoveryServer: "192.168.1.10:6399"
    });
    expect(result.source).toBe("native");
    expect(result.devices).toEqual([device]);
  });
});
