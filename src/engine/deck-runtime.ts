import type { Deck, DeckLayerRef, Layer } from "../domain/deck.js";
import { getDeckLayer } from "../domain/deck.js";

export interface DeckRuntimeState {
  readonly deckId: string;
  readonly previewLayerId: string | null;
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
      previewLayerId: null,
      activeLayerId: null
    };

    this.states.set(deck.id, state);
    return state;
  }

  previewLayer(deck: Deck, layerId: string): DeckRuntimeState {
    getDeckLayer(deck, { deckId: deck.id, layerId });
    this.require(deck.id);

    const state: DeckRuntimeState = {
      ...this.require(deck.id),
      previewLayerId: layerId
    };

    this.states.set(deck.id, state);
    return state;
  }

  clearPreview(deckId: string): DeckRuntimeState {
    const state: DeckRuntimeState = {
      ...this.require(deckId),
      previewLayerId: null
    };

    this.states.set(deckId, state);
    return state;
  }

  programLayer(deck: Deck, layerId: string): DeckRuntimeState {
    getDeckLayer(deck, { deckId: deck.id, layerId });
    this.require(deck.id);

    const state: DeckRuntimeState = {
      ...this.require(deck.id),
      activeLayerId: layerId,
      previewLayerId: layerId
    };

    this.states.set(deck.id, state);
    return state;
  }

  clearActiveLayer(deckId: string): DeckRuntimeState {
    const state: DeckRuntimeState = {
      ...this.require(deckId),
      activeLayerId: null
    };

    this.states.set(deckId, state);
    return state;
  }

  getState(deckId: string): DeckRuntimeState {
    return this.require(deckId);
  }

  getPreviewLayer(deck: Deck): Layer | null {
    const state = this.require(deck.id);
    return state.previewLayerId === null
      ? null
      : getDeckLayer(deck, { deckId: deck.id, layerId: state.previewLayerId });
  }

  getActiveLayer(deck: Deck): Layer | null {
    const state = this.require(deck.id);
    return state.activeLayerId === null
      ? null
      : getDeckLayer(deck, { deckId: deck.id, layerId: state.activeLayerId });
  }

  getPreviewSource(deck: Deck): DeckLayerRef | null {
    const layer = this.getPreviewLayer(deck);
    return layer ? { deckId: deck.id, layerId: layer.id } : null;
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
