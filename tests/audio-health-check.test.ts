import { describe, expect, it, vi } from "vitest";
import { checkAudioDevices, checkVisCoVirtualAudio } from "../src/engine/audio-health-check.js";

describe("audio health check", () => {
  it("reports detected virtual audio devices", async () => {
    const provider = {
      listDevices: vi.fn().mockResolvedValue([
        { id: "a", label: "CABLE-A Input (VB-Audio Virtual Cable)", kind: "output", virtual: true, provider: "VB-CABLE A" },
        { id: "b", label: "Speakers", kind: "output", virtual: false }
      ])
    };

    const items = await checkAudioDevices(provider);

    expect(items[0]).toMatchObject({ id: "audio-devices", status: "ok" });
    expect(items[1]).toMatchObject({
      id: "virtual-audio-devices",
      status: "ok",
      message: expect.stringContaining("VB-CABLE A")
    });
  });

  it("reports missing devices as a warning instead of an error", async () => {
    const provider = {
      listDevices: vi.fn().mockResolvedValue([])
    };

    const items = await checkAudioDevices(provider);

    expect(items[0].status).toBe("warning");
  });

  it("reports native VisCo Virtual Audio availability per channel", async () => {
    const bridge = {
      refresh: vi.fn()
        .mockResolvedValueOnce({ channel: "A", endpoint: { id: "a", name: "VisCo Virtual Audio A", channel: "A", enabled: true, sampleRate: 48000, channels: 2 }, status: "stopped" })
        .mockResolvedValueOnce({ channel: "B", endpoint: { id: "b", name: "VisCo Virtual Audio B", channel: "B", enabled: true, sampleRate: 48000, channels: 2 }, status: "unavailable", error: "Driver not installed." })
    };

    const items = await checkVisCoVirtualAudio(bridge);

    expect(items[0]).toMatchObject({ id: "visco-virtual-audio-a", status: "ok" });
    expect(items[1]).toMatchObject({ id: "visco-virtual-audio-b", status: "warning" });
  });
});
