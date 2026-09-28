export type AudioDeviceKind = "input" | "output";

export interface AudioDevice {
  readonly id: string;
  readonly label: string;
  readonly kind: AudioDeviceKind;
  readonly groupId?: string;
  /** True when the device appears to be a virtual audio endpoint. */
  readonly virtual: boolean;
  /** Optional vendor/device hint, for example VB-CABLE A or B. */
  readonly provider?: string;
}

export interface AudioDeviceProvider {
  listDevices(): Promise<readonly AudioDevice[]>;
}

/**
 * Browser/device discovery boundary.
 *
 * VisCo's routing engine must not know how Windows exposes an audio device.
 * The desktop runtime can later provide a native implementation while this
 * implementation keeps the current web UI usable.
 */
export class BrowserAudioDeviceProvider implements AudioDeviceProvider {
  async listDevices(): Promise<readonly AudioDevice[]> {
    if (!globalThis.navigator?.mediaDevices?.enumerateDevices) {
      return [];
    }

    const devices = await globalThis.navigator.mediaDevices.enumerateDevices();

    return devices
      .filter((device) => device.kind === "audioinput" || device.kind === "audiooutput")
      .map((device) => {
        const kind: AudioDeviceKind = device.kind === "audioinput" ? "input" : "output";
        const label = device.label || "Unnamed audio device";
        const virtual = isVirtualAudioDevice(label);

        return {
          id: device.deviceId,
          label,
          kind,
          groupId: device.groupId || undefined,
          virtual,
          provider: virtual ? detectVirtualAudioProvider(label) : undefined
        };
      });
  }
}

export function isVirtualAudioDevice(label: string): boolean {
  const normalized = label.toLowerCase();

  return [
    "vb-cable",
    "cable input",
    "cable output",
    "virtual audio",
    "virtual cable",
    "voicemeeter",
    "blackhole",
    "loopback"
  ].some((marker) => normalized.includes(marker));
}

export function detectVirtualAudioProvider(label: string): string | undefined {
  const normalized = label.toLowerCase();

  if (normalized.includes("vb-cable a")) return "VB-CABLE A";
  if (normalized.includes("vb-cable b")) return "VB-CABLE B";
  if (normalized.includes("voicemeeter")) return "Voicemeeter";
  if (normalized.includes("blackhole")) return "BlackHole";
  if (normalized.includes("loopback")) return "Loopback";
  if (isVirtualAudioDevice(label)) return "Virtual Audio Device";

  return undefined;
}
