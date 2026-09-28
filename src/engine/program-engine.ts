import type { Deck, DeckLayerRef, Layer, Transition } from "../domain/deck.js";
import { getDeckLayer } from "../domain/deck.js";

export interface ProgramLayerState {
  readonly source: DeckLayerRef;
  readonly layer: Layer;
}

export interface ProgramState {
  readonly compositionId: string;
  /** Canonical multi-Layer Program state, ordered by active formasi order. */
  readonly layers: readonly ProgramLayerState[];
  /** Backward-compatible first Layer accessor. */
  readonly source: DeckLayerRef | null;
  /** Backward-compatible first Layer accessor. */
  readonly layer: Layer | null;
  readonly transition: Transition | null;
}

function snapshotLayer(layer: Layer): Layer {
  return {
    ...layer,
    transform: layer.transform ? { ...layer.transform } : undefined,
    playback: layer.playback ? { ...layer.playback } : undefined
  };
}

function createState(
  compositionId: string,
  layers: readonly ProgramLayerState[],
  transition: Transition | null
): ProgramState {
  return {
    compositionId,
    layers,
    get source() {
      return layers[0]?.source ?? null;
    },
    get layer() {
      return layers[0]?.layer ?? null;
    },
    transition
  };
}

/**
 * Program state is composition-scoped so Venue and Media can run independently.
 * The no-argument API remains the active/default composition for compatibility.
 */
export class ProgramEngine {
  private readonly states = new Map<string, ProgramState>();

  getState(compositionId = "default"): ProgramState {
    return this.states.get(compositionId) ?? createState(compositionId, [], null);
  }

  getStates(): readonly ProgramState[] {
    return [...this.states.values()];
  }

  /** Force-detaches a Source from committed Program snapshots. The Program remains active with a missing Source. */
  detachSource(sourceId: string): readonly ProgramState[] {
    const updated: ProgramState[] = [];
    for (const [compositionId, state] of this.states) {
      const layers = state.layers.map((item) =>
        item.layer.sourceId === sourceId
          ? { ...item, layer: { ...item.layer, sourceId: null } }
          : item
      );
      const next = createState(compositionId, layers, state.transition);
      this.states.set(compositionId, next);
      updated.push(next);
    }
    return updated;
  }

  program(deck: Deck, layerId: string, compositionId = "default"): ProgramState {
    return this.programLayers(deck, [layerId], compositionId);
  }

  programLayers(deck: Deck, layerIds: readonly string[], compositionId = "default"): ProgramState {
    if ((deck.masterLevel ?? 100) <= 0) {
      throw new Error(`Deck "${deck.id}" is muted by M and cannot enter Program.`);
    }
    if (layerIds.length === 0) {
      throw new Error(`Deck "${deck.id}" requires at least one Layer to enter Program.`);
    }

    const seen = new Set<string>();
    const layers = layerIds.map((layerId) => {
      if (seen.has(layerId)) {
        throw new Error(`Layer "${layerId}" is duplicated in Program formasi.`);
      }
      seen.add(layerId);
      const layer = getDeckLayer(deck, { deckId: deck.id, layerId });
      return {
        source: { deckId: deck.id, layerId: layer.id },
        layer: snapshotLayer(layer)
      };
    });

    const state = createState(compositionId, layers, deck.transition);
    this.states.set(compositionId, state);
    return state;
  }
}
