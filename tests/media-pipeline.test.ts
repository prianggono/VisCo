import { describe, expect, it } from "vitest";
import { createMediaPipelineSession, chooseMediaBackend } from "../src/engine/media-pipeline.js";
describe("media pipeline",()=>{
  it("prefers Media Foundation",()=>expect(chooseMediaBackend({uri:"file.mp4"})).toBe("media-foundation"));
  it("falls back to FFmpeg compatibility",()=>expect(createMediaPipelineSession({uri:"file.mkv"},false).backend).toBe("ffmpeg-compatibility"));
});
