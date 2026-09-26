export type PhysicalOutputKind = "display" | "led";
export type VirtualOutputKind = "virtual";
export type OutputKind = "display" | "media";
export type MediaOutputKind = "stream" | "record" | "virtual";

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

/**
 * Shared Media Composition render pipeline.
 * Stream, Record and Virtual Out consume the same rendered composition,
 * while Stream and Record keep independent encoder settings.
 */
export interface MediaOutputSettings {
  readonly compositionId?: string;
  readonly resolution: readonly [width: number, height: number];
  readonly fps: number;
  readonly streaming: boolean;
  readonly recording: boolean;
  readonly virtual: boolean;
  readonly stream?: StreamSettings;
  readonly record?: RecordSettings;
}

/** Runtime routing target. Deck is the only override owner. */
export interface OutputTarget {
  readonly id: string;
  readonly kind: OutputKind;
  readonly enabled: boolean;
  readonly deckId?: string;
  readonly media?: MediaOutputSettings;
}
