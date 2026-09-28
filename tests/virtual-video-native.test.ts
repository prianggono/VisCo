import { describe, expect, it } from "vitest";
import { UnavailableNativeVirtualVideoBridge } from "../src/engine/virtual-video-native.js";

const format = { width: 1920, height: 1080, fps: 30, bitDepth: 8 as const };

describe("native virtual video bridge", () => {
  it("does not falsely report a Windows virtual video device as installed", async () => {
    const bridge = new UnavailableNativeVirtualVideoBridge();
    const state = await bridge.refresh();

    expect(state.status).toBe("unavailable");
    expect(state.deviceId).toBe("visco-virtual-video");
  });

  it("returns an actionable state when starting without the native backend", async () => {
    const bridge = new UnavailableNativeVirtualVideoBridge();
    const state = await bridge.start(format);

    expect(state.status).toBe("unavailable");
    expect(state.error).toContain("not installed");
    expect(state.format).toEqual(format);
  });
});
