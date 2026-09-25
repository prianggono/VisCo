import type { Deck, Layer } from "../domain/deck.js";
import type { DeckProgramController, DeckProgramControllerState } from "../engine/deck-program-controller.js";

export type LayerClickTarget = "name" | "box";

export interface LayerViewState {
  readonly layer: Layer;
  readonly isPreview: boolean;
  readonly isProgram: boolean;
}

export interface DeckLayerViewState {
  readonly deckId: string;
  readonly layers: readonly LayerViewState[];
  readonly previewLayerId: string | null;
  readonly activeLayerId: string | null;
}

/**
 * Framework-neutral UI adapter for the operator interaction:
 * - Layer name click -> Preview only
 * - Layer box click -> immediate Program
 *
 * The adapter deliberately does not expose a TAKE action.
 */
export class LayerInteraction {
  constructor(private readonly controller: DeckProgramController) {}

  click(deck: Deck, layerId: string, target: LayerClickTarget): DeckProgramControllerState | ReturnType<DeckProgramController["preview"]> {
    if (target === "name") {
      return this.controller.preview(deck, layerId);
    }

    return this.controller.program(deck, layerId);
  }

  getViewState(deck: Deck): DeckLayerViewState {
    const state = this.controller.getState(deck.id);

    return {
      deckId: deck.id,
      previewLayerId: state.deck.previewLayerId,
      activeLayerId: state.deck.activeLayerId,
      layers: deck.layers.map((layer) => ({
        layer,
        isPreview: layer.id === state.deck.previewLayerId,
        isProgram: layer.id === state.deck.activeLayerId
      }))
    };
  }
}
