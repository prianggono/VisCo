import { describe, expect, it } from "vitest";
import { OutputEngine } from "../src/engine/output-engine.js";

describe("OutputEngine media settings", () => {
  it("updates shared composition output settings without changing routing", () => {
    const engine = new OutputEngine();
    engine.register({
      id: "production",
      kind: "media",
      enabled: true,
      compositionId: "default",
      media: {
        compositionId: "default",
        resolution: [1920, 1080],
        fps: 30,
        streaming: false,
        recording: false,
        virtual: false,
        stream: { resolution: [1920,1080], fps: 30, codec: "h264", bitrate: "auto", server: "", key: "" },
        record: { resolution: [1920,1080], fps: 30, codec: "h264", bitrate: "auto", segmentMinutes: 60, targetFolder: "" }
      }
    });
    engine.updateMediaSettings("production", { resolution: [1280,720], fps: 30 });
    engine.updateMediaSettings("production", { stream: { resolution: [1280,720], fps: 30, codec: "hevc", bitrate: 8000, server: "", key: "" } });
    const media = engine.getState("production").target.media;
    expect(media?.resolution).toEqual([1280,720]);
    expect(media?.stream?.codec).toBe("hevc");
    expect(media?.stream?.bitrate).toBe(8000);
  });
});
