import type { Deck, DeckLayerRef, Layer } from "../domain/deck.js";
import { getDeckLayer } from "../domain/deck.js";

export interface DeckRuntimeState {
  readonly deckId: string;
  readonly activeLayerId: string | null;
}

export class DeckRuntime {
  private readonly states = new Map<string, DeckRuntimeState>();

  register(deck: Deck): DeckRuntimeState {
    if (this.states.has(deck.id)) {
      throw new Error(`Deck "${deck.id}" is already registered.`);
    }

    const state: DeckRuntimeState = {
      deckId: deck.id,
      activeLayerId: null
    };

    this.states.set(deck.id, state);
    return state;
  }

  setActiveLayer(deck: Deck, layerId: string): DeckRuntimeState {
    getDeckLayer(deck, { deckId: deck.id, layerId });

    const state: DeckRuntimeState = {
      deckId: deck.id,
      activeLayerId: layerId
    };

    this.require(deck.id);
    this.states.set(deck.id, state);
    return state;
  }

  clearActiveLayer(deckId: string): DeckRuntimeState {
    const current = this.require(deckId);
    const state: DeckRuntimeState = {
      ...current,
      activeLayerId: null
    };

    this.states.set(deckId, state);
    return state;
  }

  getState(deckId: string): DeckRuntimeState {
    return this.require(deckId);
  }

  getActiveLayer(deck: Deck): Layer | null {
    const state = this.require(deck.id);
    if (state.activeLayerId === null) {
      return null;
    }

    return getDeckLayer(deck, {
      deckId: deck.id,
      layerId: state.activeLayerId
    });
  }

  getActiveSource(deck: Deck): DeckLayerRef | null {
    const layer = this.getActiveLayer(deck);
    return layer ? { deckId: deck.id, layerId: layer.id } : null;
  }

  private require(deckId: string): DeckRuntimeState {
    const state = this.states.get(deckId);
    if (!state) {
      throw new Error(`Deck "${deckId}" is not registered.`);
    }
    return state;
  }
}
