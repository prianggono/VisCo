import { describe, expect, it, vi } from "vitest";
import { VirtualAudioEngine } from "../src/engine/virtual-audio-engine.js";

describe("VirtualAudioEngine", () => {
  it("defines independent A and B endpoints", () => {
    const engine = new VirtualAudioEngine();

    expect(engine.getEndpoint("A").name).toBe("VisCo Virtual Audio A");
    expect(engine.getEndpoint("B").name).toBe("VisCo Virtual Audio B");
    expect(engine.getEndpoint("A").sampleRate).toBe(48000);
    expect(engine.getEndpoint("B").channels).toBe(2);
  });

  it("does not claim native availability without a backend", () => {
    const engine = new VirtualAudioEngine();

    expect(engine.isAvailable()).toBe(false);
    expect(() => engine.start("A")).rejects.toThrow("native backend is not installed");
  });

  it("delegates lifecycle to a native backend", async () => {
    const backend = {
      platform: "windows" as const,
      isAvailable: vi.fn(() => true),
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined)
    };
    const engine = new VirtualAudioEngine(undefined, backend);

    await engine.start("A");

    expect(backend.start).toHaveBeenCalledWith(engine.getEndpoint("A"));
    expect(engine.isRunning("A")).toBe(true);

    await engine.stop("A");

    expect(backend.stop).toHaveBeenCalledWith(engine.getEndpoint("A"));
    expect(engine.isRunning("A")).toBe(false);
  });

  it("keeps VisCo disabled state authoritative", async () => {
    const backend = {
      platform: "windows" as const,
      isAvailable: vi.fn(() => true),
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined)
    };
    const engine = new VirtualAudioEngine(undefined, backend);
    engine.setEnabled(false);

    await expect(engine.start("A")).rejects.toThrow("Virtual Audio is disabled");
    expect(backend.start).not.toHaveBeenCalled();
  });
});
