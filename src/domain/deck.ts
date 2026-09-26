export type TransitionType = "cut" | "fade" | "wipe";

export interface Transition {
  readonly type: TransitionType;
  readonly durationMs: number;
}

import type { Layer } from "./layer.js";

export { type Layer } from "./layer.js";

export interface Deck {
  readonly id: string;
  readonly name: string;
  readonly layers: readonly Layer[];
  /** Composition context; omitted by legacy decks and treated as "default". */
  readonly compositionId?: string;
  readonly masterEnabled?: boolean;
  readonly audioLevel?: number;
  readonly visualLevel?: number;
  readonly loop?: boolean;
  readonly transition: Transition;
}

export interface DeckLayerRef {
  readonly deckId: string;
  readonly layerId: string;
}

export function findLayer(deck: Deck, layerId: string): Layer {
  const layer = deck.layers.find((candidate) => candidate.id === layerId);
  if (!layer) {
    throw new Error(`Layer "${layerId}" does not exist in deck "${deck.id}".`);
  }
  return layer;
}

export function getDeckLayer(deck: Deck, ref: DeckLayerRef): Layer {
  if (deck.id !== ref.deckId) {
    throw new Error(`Deck mismatch: expected "${ref.deckId}", got "${deck.id}".`);
  }
  return findLayer(deck, ref.layerId);
}
