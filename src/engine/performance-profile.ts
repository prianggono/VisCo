export interface PerformanceProbe {
  readonly gpuScore: number;
  readonly cpuScore: number;
  readonly memoryGb: number;
  readonly targetWidth: number;
  readonly targetHeight: number;
}

export interface PerformanceProfile {
  readonly resolution: readonly [number, number];
  readonly fps: 30;
  readonly quality: "full" | "balanced" | "safe";
  readonly reason: string;
}

export function choosePerformanceProfile(probe: PerformanceProbe): PerformanceProfile {
  if (![probe.gpuScore, probe.cpuScore, probe.memoryGb, probe.targetWidth, probe.targetHeight].every(Number.isFinite)) {
    throw new Error("Performance probe contains invalid values.");
  }
  if (probe.memoryGb < 8 || probe.gpuScore < 2 || probe.cpuScore < 2) {
    return { resolution: [1280, 720], fps: 30, quality: "safe", reason: "Low hardware capability; use 720p to protect runtime stability." };
  }
  if (probe.memoryGb < 16 || probe.gpuScore < 4 || probe.cpuScore < 4) {
    return { resolution: [1920, 1080], fps: 30, quality: "balanced", reason: "Moderate hardware capability; keep 30 FPS with balanced output." };
  }
  return {
    resolution: [probe.targetWidth, probe.targetHeight],
    fps: 30,
    quality: "full",
    reason: "Hardware headroom is sufficient for the requested composition."
  };
}
