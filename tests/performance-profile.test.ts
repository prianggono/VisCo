import { describe, expect, it } from "vitest";
import { choosePerformanceProfile } from "../src/engine/performance-profile.js";

describe("performance profile", () => {
  it("falls back to 720p on weak hardware", () => {
    expect(choosePerformanceProfile({ gpuScore: 1, cpuScore: 3, memoryGb: 8, targetWidth: 1920, targetHeight: 1080 }).resolution).toEqual([1280, 720]);
  });
  it("keeps the project target on capable hardware", () => {
    const result = choosePerformanceProfile({ gpuScore: 8, cpuScore: 8, memoryGb: 32, targetWidth: 3840, targetHeight: 2160 });
    expect(result.resolution).toEqual([3840, 2160]);
    expect(result.fps).toBe(30);
  });
});
