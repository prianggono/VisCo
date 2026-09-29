import { describe, expect, it, vi } from "vitest";
import { AudioDeviceEngine } from "../src/engine/audio-device-engine.js";

describe("AudioDeviceEngine", () => {
  it("prefers ASIO and keeps WASAPI as fallback", async () => {
    const bridge = { enumerate: vi.fn(async()=>[{id:"a",name:"Card",inputs:2,outputs:2,sampleRates:[48000],channels:2}]), open:vi.fn(async()=>{}), close:vi.fn(async()=>{}), readInput:vi.fn(async()=>null), writeOutput:vi.fn(async()=>{}) };
    const engine = new AudioDeviceEngine(bridge);
    await engine.select("a");
    expect(engine.getBackend()).toBe("asio");
  });
});
