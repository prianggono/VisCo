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
  | "video-delay";

export interface ListItem {
  readonly id: string;
  readonly sourceId: string;
  readonly order: number;
  readonly interlaced?: boolean;
}

export interface DocumentSourceConfig {
  readonly currentPage: number;
  readonly totalPages?: number;
  readonly autoNext: boolean;
  readonly durationMs: number;
  readonly autoFirst: boolean;
  readonly loop: boolean;
}

export interface ListConfig {
  readonly itemIds: readonly string[];
  readonly shuffle: boolean;
  readonly playOut: boolean;
  readonly autoNext: boolean;
  readonly autoFirst: boolean;
  readonly loop: boolean;
  readonly interlaced: boolean;
}

export interface Source {
  readonly id: string;
  readonly name: string;
  readonly kind: SourceKind;
  readonly uri?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly list?: ListConfig;
  readonly document?: DocumentSourceConfig;
}

export interface Library {
  readonly sourceIds: readonly string[];
}
