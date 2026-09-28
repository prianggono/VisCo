import { describe, expect, it } from "vitest";
import { FramePipeline, NativeFrameSourceProvider } from "../src/engine/frame-pipeline.js";
import type { DiscoveredDevice } from "../src/domain/device.js";
import type { FrameSource } from "../src/domain/frame-source.js";

function source(device: DiscoveredDevice): FrameSource {
  return {
    id: `frame-${device.id}`,
    device,
    start: async () => undefined,
    stop: async () => undefined,
    getStatus: () => ({
      id: `frame-${device.id}`,
      running: false,
      frameCount: 0,
      lastFrameTimestampUs: null
    }),
    subscribe: () => () => undefined
  };
}

describe("FramePipeline", () => {
  it("keeps frame creation behind the native bridge", async () => {
    const device: DiscoveredDevice = {
      id: "desktop-1",
      name: "Desktop 1",
      kind: "desktop-capture",
      transport: "local"
    };
    const calls: DiscoveredDevice[] = [];
    const pipeline = new FramePipeline();

    pipeline.register(new NativeFrameSourceProvider({
      createSource: async ({ device }) => {
        calls.push(device);
        return source(device);
      }
    }));

    const result = await pipeline.create(device);

    expect(calls).toEqual([device]);
    expect(result.id).toBe("frame-desktop-1");
  });

  it("does not invent a frame provider when none is registered", async () => {
    const pipeline = new FramePipeline();
    const device: DiscoveredDevice = {
      id: "ndi-1",
      name: "NDI 1",
      kind: "ndi",
      transport: "network"
    };

    await expect(pipeline.create(device)).rejects.toThrow(
      'No frame source provider is registered for device "ndi-1".'
    );
  });
});
