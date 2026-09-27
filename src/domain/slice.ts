import type { DeckLayerRef } from "./deck.js";

export interface SliceTransform {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

export interface Slice {
  readonly id: string;
  readonly name: string;
  readonly transform: SliceTransform;
  /** Slice belongs to a Composition and can map Layers from multiple Decks. */
  readonly layerRefs: readonly DeckLayerRef[];
  readonly locked: boolean;
}
