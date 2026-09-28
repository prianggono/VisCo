import { describe, expect, it } from "vitest";
import { checkVisCoVirtualVideo } from "../src/engine/video-health-check.js";
import { UnavailableNativeVirtualVideoBridge } from "../src/engine/virtual-video-native.js";

describe("Virtual Video health check", () => {
  it("reports unavailable when the native backend is not installed", async () => {
    const item = await checkVisCoVirtualVideo(
      new UnavailableNativeVirtualVideoBridge()
    );

    expect(item.id).toBe("visco-virtual-video");
    expect(item.status).toBe("warning");
    expect(item.message).toContain("Native backend status");
  });
});
