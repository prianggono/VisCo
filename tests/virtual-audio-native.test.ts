import { describe, expect, it } from "vitest";
import {
  UnavailableNativeVirtualAudioBridge
} from "../src/engine/virtual-audio-native.js";
import { DEFAULT_VIRTUAL_AUDIO_CONFIG } from "../src/domain/virtual-audio.js";

describe("native virtual audio bridge", () => {
  const endpoints = new Map(
    DEFAULT_VIRTUAL_AUDIO_CONFIG.endpoints.map((endpoint) => [endpoint.channel, endpoint])
  );

  it("reports the native backend as unavailable without pretending a driver exists", async () => {
    const bridge = new UnavailableNativeVirtualAudioBridge(endpoints);

    const state = await bridge.getState("A");

    expect(state.status).toBe("unavailable");
    expect(state.endpoint.name).toBe("VisCo Virtual Audio A");
  });

  it("returns an actionable error when native start is requested", async () => {
    const bridge = new UnavailableNativeVirtualAudioBridge(endpoints);

    const state = await bridge.start("B");

    expect(state.status).toBe("unavailable");
    expect(state.error).toContain("native Virtual Audio backend is not installed");
  });
});
