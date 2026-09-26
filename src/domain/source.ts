export type SourceKind =
  | "video"
  | "image"
  | "audio"
  | "audio-input"
  | "list"
  | "image-sequence"
  | "stinger"
  | "powerpoint"
  | "pdf"
  | "camera"
  | "ndi"
  | "desktop-capture"
  | "ip-camera"
  | "colour"
  | "timer"
  | "title"
  | "composition"
  | "video-delay"
  | "web-browser";

export interface Source {
  readonly id: string;
  readonly name: string;
  readonly kind: SourceKind;
  readonly uri?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface Library {
  readonly sourceIds: readonly string[];
}
