import { describe, expect, it } from "vitest";
import { createUnavailableNativeOutputBackend } from "../src/engine/native-output-backend.js";

describe("native output backend", () => {
  it("exposes all output backends without a native installation", async () => {
    const backend = createUnavailableNativeOutputBackend();

    expect(await backend.display.enumerateDisplays()).toEqual([]);
    expect(await backend.led.enumerateDevices()).toEqual([]);
    expect(await backend.stream.enumerateEncoders()).toEqual([]);
    expect(await backend.record.enumerateCodecs()).toEqual([]);
  });

  it("keeps the virtual video bridge in the same output boundary", async () => {
    const backend = createUnavailableNativeOutputBackend();
    const state = await backend.virtualVideo.getState();

    expect(state.status).toBe("unavailable");
    expect(state.name).toBe("VisCo Virtual Video");
  });
});
