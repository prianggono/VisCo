import { describe, expect, it } from "vitest";
import { VirtualVideoEngine } from "../src/engine/virtual-video-engine.js";
import { UnavailableNativeVirtualVideoBridge } from "../src/engine/virtual-video-native.js";

describe("Virtual Video Engine", () => {
  it("delegates lifecycle to the native bridge", async () => {
    const engine = new VirtualVideoEngine(new UnavailableNativeVirtualVideoBridge());
    const state = await engine.start({ width: 1920, height: 1080, fps: 30, bitDepth: 8 });

    expect(state.status).toBe("unavailable");
    expect(state.error).toContain("not installed");
  });
});
