import type { AudioDevice, AudioDeviceProvider } from "./audio-device.js";
import type { NativeVirtualAudioBridge } from "./virtual-audio-native.js";
import type { HealthCheckItem } from "./health-check.js";

export async function checkAudioDevices(
  provider: AudioDeviceProvider
): Promise<readonly HealthCheckItem[]> {
  try {
    const devices = await provider.listDevices();

    if (devices.length === 0) {
      return [{
        id: "audio-devices",
        label: "Audio Devices",
        status: "warning",
        message: "No Windows/browser audio devices are currently visible to VisCo."
      }];
    }

    return [
      {
        id: "audio-devices",
        label: "Audio Devices",
        status: "ok",
        message: `${devices.length} audio device(s) detected.`
      },
      ...summarizeVirtualDevices(devices)
    ];
  } catch (error) {
    return [{
      id: "audio-devices",
      label: "Audio Devices",
      status: "error",
      message: error instanceof Error ? error.message : "Audio device discovery failed."
    }];
  }
}

export async function checkVisCoVirtualAudio(
  bridge: NativeVirtualAudioBridge
): Promise<readonly HealthCheckItem[]> {
  const items: HealthCheckItem[] = [];

  for (const channel of ["A", "B"] as const) {
    try {
      const state = await bridge.refresh(channel);
      items.push({
        id: `visco-virtual-audio-${channel.toLowerCase()}`,
        label: `VisCo Virtual Audio ${channel}`,
        status: state.status === "running" || state.status === "stopped" ? "ok" : "warning",
        message: state.error ?? `Native backend status: ${state.status}.`
      });
    } catch (error) {
      items.push({
        id: `visco-virtual-audio-${channel.toLowerCase()}`,
        label: `VisCo Virtual Audio ${channel}`,
        status: "error",
        message: error instanceof Error ? error.message : "Virtual Audio health check failed."
      });
    }
  }

  return items;
}

function summarizeVirtualDevices(devices: readonly AudioDevice[]): readonly HealthCheckItem[] {
  const virtual = devices.filter((device) => device.virtual);

  if (virtual.length === 0) {
    return [{
      id: "virtual-audio-devices",
      label: "External Virtual Audio",
      status: "warning",
      message: "No external virtual audio device detected."
    }];
  }

  const providers = [...new Set(virtual.map((device) => device.provider).filter(Boolean))];

  return [{
    id: "virtual-audio-devices",
    label: "External Virtual Audio",
    status: "ok",
    message: `${virtual.length} virtual audio endpoint(s) detected${providers.length ? `: ${providers.join(", ")}` : "."}`
  }];
}
