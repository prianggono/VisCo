import { describe, expect, it, vi } from "vitest";
import { RuntimeCoordinator } from "../src/engine/runtime-coordinator.js";

describe("RuntimeCoordinator", () => {
  it("initializes and renders through the native boundary", async () => {
    const renderer = {
      initialize: vi.fn(async () => ({ backend: "d3d11" as const, maxTextureSize: 8192, supportsVideo: true, supportsCompute: true })),
      render: vi.fn(async () => undefined),
      flush: vi.fn(async () => undefined),
      dispose: vi.fn(async () => undefined),
      resize: vi.fn(async () => undefined),
    };
    const runtime = new RuntimeCoordinator(renderer as never);
    expect(runtime.getStats().running).toBe(false);
    await runtime.start();
    runtime.setContext(
      { compositionId: "c1", layers: [], layer: null, source: null },
      { id: "s1", name: "Scene", compositionId: "c1", target: { kind: "display", displayId: "d1" }, enabled: true },
      { id: "c1", name: "C", format: { width: 1280, height: 720, fps: 30, bitDepth: 8 }, deckIds: [], groupIds: [], sliceIds: [], locked: false },
      []
    );
    await new Promise((resolve) => setTimeout(resolve, 40));
    await runtime.stop();
    expect(renderer.initialize).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });
});
