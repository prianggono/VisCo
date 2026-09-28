export type AudioDeviceKind = "input" | "output";

export interface AudioDevice {
  readonly id: string;
  readonly label: string;
  readonly kind: AudioDeviceKind;
  readonly groupId?: string;
  readonly virtual: boolean;
  readonly provider?: string;
}

export interface AudioDeviceProvider {
  listDevices(): Promise<readonly AudioDevice[]>;
}

export function isVirtualAudioDevice(label: string): boolean {
  return detectVirtualAudioProvider(label) !== undefined;
}

export function detectVirtualAudioProvider(label: string): string | undefined {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes("cable-a") && normalized.includes("vb-audio")) return "VB-CABLE A";
  if (normalized.includes("cable-b") && normalized.includes("vb-audio")) return "VB-CABLE B";
  if (normalized.includes("voicemeeter")) return "VoiceMeeter";
  return undefined;
}

export class BrowserAudioDeviceProvider implements AudioDeviceProvider {
  async listDevices(): Promise<readonly AudioDevice[]> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === "audioinput" || device.kind === "audiooutput")
      .map((device) => {
        const kind: AudioDeviceKind = device.kind === "audioinput" ? "input" : "output";
        const provider = detectVirtualAudioProvider(device.label);
        return {
          id: device.deviceId,
          label: device.label,
          kind,
          groupId: device.groupId,
          virtual: provider !== undefined,
          provider
        };
      });
  }
}
