import { describe, expect, it, vi } from "vitest";
import { isOwnedObjectUrl, revokeOwnedObjectUrl, revokeOwnedObjectUrls } from "../src/engine/object-url-lifecycle.js";

describe("Object URL lifecycle", () => {
  it("only treats blob URLs as VisCo-owned object URLs", () => {
    expect(isOwnedObjectUrl("blob:http://localhost/123")).toBe(true);
    expect(isOwnedObjectUrl("https://example.com/video.mp4")).toBe(false);
    expect(isOwnedObjectUrl("rtsp://camera/stream")).toBe(false);
    expect(isOwnedObjectUrl(undefined)).toBe(false);
  });

  it("revokes only owned object URLs", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    revokeOwnedObjectUrl({ uri: "blob:http://localhost/123" });
    revokeOwnedObjectUrl({ uri: "https://example.com/video.mp4" });
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:http://localhost/123");
    revoke.mockRestore();
  });

  it("can release a collection of owned media URLs", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    revokeOwnedObjectUrls([
      { uri: "blob:http://localhost/1" },
      { uri: "blob:http://localhost/2" },
      { uri: "rtsp://camera/stream" }
    ]);
    expect(revoke).toHaveBeenCalledTimes(2);
    revoke.mockRestore();
  });
});
