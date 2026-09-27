import type { Composition } from "./composition.js";
import type { DeckLayerRef } from "./deck.js";

export interface SliceTransform {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

/**
 * Default Slice fills the entire Composition.
 * x/y are the Slice center coordinates because the renderer positions
 * the Slice from its center.
 */
export function getDefaultSliceTransform(composition: Composition): SliceTransform {
  return {
    x: composition.format.width / 2,
    y: composition.format.height / 2,
    width: composition.format.width,
    height: composition.format.height,
    rotation: 0
  };
}

export interface Slice {
  readonly id: string;
  readonly name: string;
  readonly transform: SliceTransform;
  /** Slice belongs to a Composition and can map Layers from multiple Decks. */
  readonly layerRefs: readonly DeckLayerRef[];
  readonly locked: boolean;
}
