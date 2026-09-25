import type { Deck, DeckLayerRef, Layer, Transition } from "../domain/deck.js";
import { getDeckLayer } from "../domain/deck.js";

export interface ProgramState {
  readonly source: DeckLayerRef | null;
  readonly layer: Layer | null;
  readonly transition: Transition | null;
}

export class ProgramEngine {
  private state: ProgramState = {
    source: null,
    layer: null,
    transition: null
  };

  getState(): ProgramState {
    return this.state;
  }

  take(deck: Deck, layerId: string): ProgramState {
    const layer = getDeckLayer(deck, { deckId: deck.id, layerId });

    this.state = {
      source: { deckId: deck.id, layerId: layer.id },
      layer,
      transition: deck.transition
    };

    return this.state;
  }
}
