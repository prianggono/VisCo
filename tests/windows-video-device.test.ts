import { describe, expect, it } from "vitest";
import type { WindowsVideoDeviceBridge } from "../src/native/windows-video-device.js";

describe("Windows video device bridge", () => {
  it("keeps camera and capture-card enumeration as explicit native categories", async () => {
    const bridge: WindowsVideoDeviceBridge = {
      enumerate: async (kind) => [{
        device: {
          id: kind + "-1",
          name: kind === "camera" ? "Webcam" : "USB HDMI Capture",
          kind,
          transport: "local"
        }
      }]
    };

    const camera = await bridge.enumerate("camera");
    const capture = await bridge.enumerate("video-capture");

    expect(camera[0].device.kind).toBe("camera");
    expect(capture[0].device.kind).toBe("video-capture");
  });
});
