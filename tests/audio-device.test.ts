import { describe, expect, it, vi } from "vitest";
import {
  BrowserAudioDeviceProvider,
  detectVirtualAudioProvider,
  isVirtualAudioDevice
} from "../src/engine/audio-device.js";

describe("audio device abstraction", () => {
  it("detects VB-CABLE A and B as virtual audio devices", () => {
    expect(isVirtualAudioDevice("CABLE-A Input (VB-Audio Virtual Cable)")).toBe(true);
    expect(isVirtualAudioDevice("CABLE-B Output (VB-Audio Virtual Cable)")).toBe(true);
    expect(detectVirtualAudioProvider("CABLE-A Input (VB-Audio Virtual Cable)")).toBe("VB-CABLE A");
    expect(detectVirtualAudioProvider("CABLE-B Output (VB-Audio Virtual Cable)")).toBe("VB-CABLE B");
  });

  it("does not classify a normal sound card as virtual", () => {
    expect(isVirtualAudioDevice("Focusrite USB Audio")).toBe(false);
    expect(detectVirtualAudioProvider("Focusrite USB Audio")).toBeUndefined();
  });

  it("maps browser audio inputs and outputs without exposing other media devices", async () => {
    const enumerateDevices = vi.fn().mockResolvedValue([
      {
        deviceId: "mic-1",
        groupId: "group-1",
        kind: "audioinput",
        label: "Focusrite USB Audio"
      },
      {
        deviceId: "cable-a",
        groupId: "group-2",
        kind: "audiooutput",
        label: "CABLE-A Input (VB-Audio Virtual Cable)"
      },
      {
        deviceId: "camera-1",
        groupId: "group-3",
        kind: "videoinput",
        label: "Camera"
      }
    ]);

    vi.stubGlobal("navigator", {
      mediaDevices: { enumerateDevices }
    });

    const devices = await new BrowserAudioDeviceProvider().listDevices();

    expect(devices).toEqual([
      {
        id: "mic-1",
        label: "Focusrite USB Audio",
        kind: "input",
        groupId: "group-1",
        virtual: false,
        provider: undefined
      },
      {
        id: "cable-a",
        label: "CABLE-A Input (VB-Audio Virtual Cable)",
        kind: "output",
        groupId: "group-2",
        virtual: true,
        provider: "VB-CABLE A"
      }
    ]);
  });
});
