import type { Source } from "./source.js";

export interface LayerTransform {
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
  /** When true, changing one scale axis updates the other proportionally. */
  readonly scaleLinked?: boolean;
  readonly rotation: number;
  readonly opacity: number;
}

export type LayerFitMode = "fit" | "fill" | "stretch";

export interface LayerPlayback {
  readonly playing: boolean;
  readonly loop: boolean;
  readonly speed: number;
}

export interface Layer {
  readonly id: string;
  readonly name: string;
  readonly sourceId?: Source["id"] | null;
  readonly transform?: LayerTransform;
  readonly playback?: LayerPlayback;
  /** Quick Resolume-style media framing mode inside the Layer bounds. */
  readonly fitMode?: LayerFitMode;
  readonly blendMode?: string;
  readonly order?: number;
}
