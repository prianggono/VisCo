import type { Source } from "./source.js";

export interface LayerTransform {
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotation: number;
  readonly opacity: number;
}

export interface Layer {
  readonly id: string;
  readonly name: string;
  readonly sourceId: Source["id"] | null;
  readonly sliceIds: readonly string[];
  readonly transform: LayerTransform;
  readonly blendMode: string;
  readonly order: number;
}
