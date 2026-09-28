export type VirtualAudioChannel = "A" | "B";

export interface VirtualAudioEndpoint {
  readonly id: string;
  readonly name: string;
  readonly channel: VirtualAudioChannel;
  readonly enabled: boolean;
  readonly sampleRate: number;
  readonly channels: 1 | 2;
}

/**
 * Platform-neutral description of VisCo's own virtual audio endpoints.
 * The native Windows implementation will own the actual OS device.
 */
export interface VirtualAudioConfig {
  readonly enabled: boolean;
  readonly endpoints: readonly VirtualAudioEndpoint[];
  readonly defaultSampleRate: number;
  readonly defaultChannels: 1 | 2;
}

export const DEFAULT_VIRTUAL_AUDIO_CONFIG: VirtualAudioConfig = {
  enabled: true,
  defaultSampleRate: 48000,
  defaultChannels: 2,
  endpoints: [
    {
      id: "visco-virtual-a",
      name: "VisCo Virtual Audio A",
      channel: "A",
      enabled: true,
      sampleRate: 48000,
      channels: 2
    },
    {
      id: "visco-virtual-b",
      name: "VisCo Virtual Audio B",
      channel: "B",
      enabled: true,
      sampleRate: 48000,
      channels: 2
    }
  ]
};
