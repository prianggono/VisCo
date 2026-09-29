import { describe, expect, it } from "vitest";
import { FrameClock } from "../src/engine/frame-clock.js";

describe("frame clock", () => {
  it("defaults to 30 FPS and never allows an invalid configuration", () => {
    const clock = new FrameClock();
    expect(clock.getStats().fps).toBe(30);
    expect(() => new FrameClock({ fps: 0 })).toThrow();
    expect(() => new FrameClock({ maxPending: 0 })).toThrow();
  });

  it("can stop and reset deterministic counters", () => {
    const clock = new FrameClock({ fps: 30 });
    clock.reset();
    clock.stop();
    expect(clock.getStats().frameNumber).toBe(0);
    expect(clock.getStats().droppedFrames).toBe(0);
  });
});
