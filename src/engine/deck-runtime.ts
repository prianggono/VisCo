import type { Deck, DeckLayerRef, Layer } from "../domain/deck.js";
import type { LayerPlayback } from "../domain/layer.js";
import { getDeckLayer } from "../domain/deck.js";

export interface LayerPlaybackState extends LayerPlayback {
  readonly layerId: string;
}

export interface DeckRuntimeState {
  readonly deckId: string;
  readonly previewLayerId: string | null;
  /** Canonical runtime Program membership. Order is the active formasi order. */
  readonly activeLayerIds: readonly string[];
  /** Backward-compatible derived accessor for single-Layer consumers. */
  readonly activeLayerId: string | null;
  readonly masterLevel: number;
  readonly audioLevel: number;
  readonly visualLevel: number;
  readonly playback: ReadonlyMap<string, LayerPlaybackState>;
  readonly listCursors: ReadonlyMap<string, number>;
  readonly columns: ReadonlyMap<number, boolean>;
}

function withActiveLayerCompatibility(state: DeckRuntimeState | Omit<DeckRuntimeState, "activeLayerId">): DeckRuntimeState {
  const { activeLayerId: _legacyActiveLayerId, ...canonical } = state as DeckRuntimeState;
  return {
    ...canonical,
    get activeLayerId() {
      return canonical.activeLayerIds[0] ?? null;
    }
  };
}

export class DeckRuntime {
  private readonly states = new Map<string, DeckRuntimeState>();

  register(deck: Deck): DeckRuntimeState {
    if (this.states.has(deck.id)) {
      throw new Error(`Deck "${deck.id}" is already registered.`);
    }

    const state = withActiveLayerCompatibility({
      deckId: deck.id,
      previewLayerId: null,
      activeLayerIds: [],
      masterLevel: deck.masterLevel ?? 100,
      audioLevel: deck.audioLevel ?? 100,
      visualLevel: deck.visualLevel ?? 100,
      playback: new Map(deck.layers.map((layer) => [layer.id, {
        layerId: layer.id,
        playing: layer.playback?.playing ?? false,
        loop: layer.playback?.loop ?? false,
        speed: layer.playback?.speed ?? 100
      }])),
      listCursors: new Map(),
      columns: new Map()
    });

    this.states.set(deck.id, state);
    return state;
  }

  setColumnEnabled(deckId: string, column: number, enabled: boolean): DeckRuntimeState {
    if (!Number.isInteger(column) || column < 1) throw new Error("Column must be a positive integer.");
    const current = this.require(deckId);
    const columns = new Map(current.columns);
    columns.set(column, enabled);
    const layer = Array.from(current.playback.values())[column - 1];
    if (!layer) throw new Error(`Column ${column} does not exist in deck "${deckId}".`);
    const playback = new Map(current.playback);
    playback.set(layer.layerId, { ...playback.get(layer.layerId)!, playing: enabled });
    const state = withActiveLayerCompatibility({ ...current, columns, playback });
    this.states.set(deckId, state);
    return state;
  }

  setMasterLevel(deckId: string, level: number): DeckRuntimeState {
    const current = this.require(deckId);
    const state = withActiveLayerCompatibility({ ...current, masterLevel: Math.max(0, Math.min(100, level)) });
    this.states.set(deckId, state);
    return state;
  }

  setAudioLevel(deckId: string, level: number): DeckRuntimeState {
    const current = this.require(deckId);
    const state = withActiveLayerCompatibility({ ...current, audioLevel: Math.max(0, Math.min(100, level)) });
    this.states.set(deckId, state);
    return state;
  }

  advanceList(deckId: string, layerId: string, itemCount: number, loop: boolean): { state: DeckRuntimeState; index: number | null } {
    const current = this.require(deckId);
    if (itemCount <= 0) return { state: current, index: null };
    const previous = current.listCursors.get(layerId) ?? -1;
    const next = previous + 1;
    if (next >= itemCount && !loop) return { state: current, index: null };
    const index = next >= itemCount ? 0 : next;
    const listCursors = new Map(current.listCursors);
    listCursors.set(layerId, index);
    const state = withActiveLayerCompatibility({ ...current, listCursors });
    this.states.set(deckId, state);
    return { state, index };
  }

  setLayerPlayback(deckId: string, layerId: string, patch: Partial<LayerPlayback>): DeckRuntimeState {
    const current = this.require(deckId);
    if (!current.playback.has(layerId)) throw new Error(`Layer "${layerId}" is not registered in deck "${deckId}".`);
    const next = {
      ...current.playback.get(layerId)!,
      ...patch,
      speed: Math.max(0, Math.min(200, patch.speed ?? current.playback.get(layerId)!.speed))
    };
    const playback = new Map(current.playback);
    playback.set(layerId, next);
    const state = withActiveLayerCompatibility({ ...current, playback });
    this.states.set(deckId, state);
    return state;
  }

  setVisualLevel(deckId: string, level: number): DeckRuntimeState {
    const current = this.require(deckId);
    const state = withActiveLayerCompatibility({ ...current, visualLevel: Math.max(0, Math.min(100, level)) });
    this.states.set(deckId, state);
    return state;
  }

  previewLayer(deck: Deck, layerId: string): DeckRuntimeState {
    getDeckLayer(deck, { deckId: deck.id, layerId });
    const current = this.require(deck.id);
    const state = withActiveLayerCompatibility({ ...current, previewLayerId: layerId });
    this.states.set(deck.id, state);
    return state;
  }

  clearPreview(deckId: string): DeckRuntimeState {
    const current = this.require(deckId);
    const state = withActiveLayerCompatibility({ ...current, previewLayerId: null });
    this.states.set(deckId, state);
    return state;
  }

  programLayer(deck: Deck, layerId: string): DeckRuntimeState {
    return this.programLayers(deck, [layerId]);
  }

  programLayers(deck: Deck, layerIds: readonly string[]): DeckRuntimeState {
    const current = this.require(deck.id);
    if (current.masterLevel <= 0) {
      throw new Error(`Deck "${deck.id}" is muted by M and cannot enter Program.`);
    }
    if (layerIds.length === 0) {
      throw new Error(`Deck "${deck.id}" requires at least one Layer to enter Program.`);
    }

    const seen = new Set<string>();
    for (const layerId of layerIds) {
      if (seen.has(layerId)) {
        throw new Error(`Layer "${layerId}" is duplicated in Program formasi.`);
      }
      seen.add(layerId);
      getDeckLayer(deck, { deckId: deck.id, layerId });
    }

    const state = withActiveLayerCompatibility({
      ...current,
      activeLayerIds: [...layerIds]
    });
    this.states.set(deck.id, state);
    return state;
  }

  deselectActiveLayer(deckId: string): DeckRuntimeState {
    return this.clearActiveLayer(deckId);
  }

  clearActiveLayer(deckId: string): DeckRuntimeState {
    const current = this.require(deckId);
    const state = withActiveLayerCompatibility({ ...current, activeLayerIds: [] });
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
    const layerId = state.activeLayerIds[0];
    return layerId === undefined ? null : getDeckLayer(deck, { deckId: deck.id, layerId });
  }

  getActiveLayers(deck: Deck): readonly Layer[] {
    const state = this.require(deck.id);
    return state.activeLayerIds.map((layerId) => getDeckLayer(deck, { deckId: deck.id, layerId }));
  }

  getPreviewSource(deck: Deck): DeckLayerRef | null {
    const layer = this.getPreviewLayer(deck);
    return layer ? { deckId: deck.id, layerId: layer.id } : null;
  }

  getActiveSource(deck: Deck): DeckLayerRef | null {
    const layer = this.getActiveLayer(deck);
    return layer ? { deckId: deck.id, layerId: layer.id } : null;
  }

  getActiveSources(deck: Deck): readonly DeckLayerRef[] {
    return this.getActiveLayers(deck).map((layer) => ({ deckId: deck.id, layerId: layer.id }));
  }

  private require(deckId: string): DeckRuntimeState {
    const state = this.states.get(deckId);
    if (!state) {
      throw new Error(`Deck "${deckId}" is not registered.`);
    }
    return state;
  }
}
