import { describe, expect, it } from "vitest";
import {
  descriptorForNativeMediaSource,
  nativeMediaStatusLabel,
  createUnavailableNativeMediaBackend
} from "../src/engine/native-media-backend.js";

describe("native media backend", () => {
  it("creates unavailable bridges without throwing", async () => {
    const backend = createUnavailableNativeMediaBackend();

    expect(await backend.ndi.discover()).toEqual([]);
    expect(await backend.omt.discover()).toEqual([]);
    expect(await backend.ipCamera.discover()).toEqual([]);
    expect(await backend.desktopCapture.enumerateTargets()).toEqual([]);
  });

  it("labels unavailable native states clearly", () => {
    expect(nativeMediaStatusLabel({
      status: "unavailable",
      error: "backend missing"
    })).toBe("UNAVAILABLE · backend missing");
  });

  it("maps OMT as a native protocol", async () => {
    const backend = createUnavailableNativeMediaBackend();
    const state = await backend.omt.start({
      sourceId: "source-omt",
      protocol: "omt",
      name: "OMT Camera"
    });
    expect(state.protocol).toBe("omt");
    expect(state.status).toBe("unavailable");
  });

  it("creates a stable source descriptor", () => {
    expect(descriptorForNativeMediaSource(
      "source-1",
      "omt",
      "Camera A",
      { streamName: "Camera A" }
    )).toEqual({
      sourceId: "source-1",
      protocol: "omt",
      name: "Camera A",
      metadata: { streamName: "Camera A" }
    });
  });
});
