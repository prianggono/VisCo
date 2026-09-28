import type { Deck, DeckLayerRef, Layer, Transition } from "../domain/deck.js";
import { getDeckLayer } from "../domain/deck.js";

export interface ProgramState {
  readonly compositionId: string;
  readonly source: DeckLayerRef | null;
  /** Active Layer retained for UI focus/trigger identity. */
  readonly layer: Layer | null;
  /** Immutable snapshot of Layers participating in this Program composition. */
  readonly layers: readonly Layer[];
  readonly transition: Transition | null;
}

export class ProgramEngine {
  private readonly states = new Map<string, ProgramState>();

  getState(compositionId = "default"): ProgramState {
    return this.states.get(compositionId) ?? {
      compositionId, source: null, layer: null, layers: [], transition: null
    };
  }

  program(deck: Deck, layerId: string, compositionId = deck.compositionId ?? "default"): ProgramState {
    const layer = getDeckLayer(deck, { deckId: deck.id, layerId });
    if ((deck.masterLevel ?? 100) <= 0) {
      throw new Error(`Deck "${deck.id}" is muted by M and cannot enter Program.`);
    }
    const state: ProgramState = {
      compositionId,
      source: { deckId: deck.id, layerId: layer.id },
      layer,
      layers: [...deck.layers],
      transition: deck.transition
    };
    this.states.set(compositionId, state);
    return state;
  }
}
