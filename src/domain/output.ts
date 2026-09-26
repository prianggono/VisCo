export type PhysicalOutputKind = "display" | "led";
export type VirtualOutputKind = "virtual";

export interface PhysicalOutput {
  readonly id: string;
  readonly kind: PhysicalOutputKind;
  readonly deviceId?: string;
  readonly enabled: boolean;
}

export interface VirtualOutput {
  readonly id: string;
  readonly kind: VirtualOutputKind;
  readonly enabled: boolean;
}

export interface EncoderSettings {
  readonly resolution: readonly [number, number];
  readonly fps: number;
  readonly codec: string;
  readonly bitrate: number | "auto";
}

export interface StreamSettings extends EncoderSettings {
  readonly server: string;
  readonly key: string;
}

export interface RecordSettings extends EncoderSettings {
  readonly segmentMinutes: 1 | 2 | 5 | 10 | 15 | 30 | 60 | "custom";
  readonly targetFolder: string;
}
