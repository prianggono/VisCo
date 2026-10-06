import type { Deck, DeckLayerRef, Layer } from "../domain/deck.js";
import type { LayerPlayback } from "../domain/layer.js";
import { getDeckLayer } from "../domain/deck.js";

export interface LayerPlaybackState extends LayerPlayback {
  readonly layerId: string;
}

export interface DeckRuntimeState {
  readonly deckId: string;
  readonly previewLayerId: string | null;
  readonly activeLayerId: string | null;
  readonly masterLevel: number;
  readonly audioLevel: number;
  readonly visualLevel: number;
  readonly playback: ReadonlyMap<string, LayerPlaybackState>;
  readonly listCursors: ReadonlyMap<string, number>;
  readonly columns: ReadonlyMap<number, boolean>;
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
      activeLayerId: null,
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
    };

    this.states.set(deck.id, state);
    return state;
  }

  /** Set one active Column across the supplied Decks and synchronize each Deck's active slot. */
  setExclusiveColumn(deckIds: readonly string[], column: number, enabled: boolean): void {
    if (!Number.isInteger(column) || column < 1) throw new Error("Column must be a positive integer.");
    for (const deckId of new Set(deckIds)) {
      const state = this.require(deckId);
      const layers = Array.from(state.playback.values());
      const target = layers[column - 1];
      if (enabled && !target) throw new Error("Column " + column + " does not exist in deck \"" + deckId + "\".");
      const columns = new Map<number, boolean>();
      const playback = new Map(state.playback);
      for (const [columnIndex, isEnabled] of state.columns) {
        const nextEnabled = enabled && columnIndex === column;
        const layer = layers[columnIndex - 1];
        if (layer && isEnabled !== nextEnabled) {
          playback.set(layer.layerId, { ...playback.get(layer.layerId)!, playing: nextEnabled });
        }
        if (nextEnabled) columns.set(columnIndex, true);
      }
      if (enabled && target) {
        playback.set(target.layerId, { ...playback.get(target.layerId)!, playing: true });
      }
      this.states.set(deckId, {
        ...state,
        columns,
        activeLayerId: enabled && target ? target.layerId : (state.activeLayerId === target?.layerId ? null : state.activeLayerId),
        playback
      });
    }
  }
  has(deckId: string): boolean {
    return this.states.has(deckId);
  }

  /** Replace the runtime registry atomically when a project is opened. */
  replaceAll(decks: readonly Deck[]): void {
    const next = new Map<string, DeckRuntimeState>();
    for (const deck of decks) {
      if (next.has(deck.id)) throw new Error(`Deck "${deck.id}" is duplicated.`);
      next.set(deck.id, {
        deckId: deck.id,
        previewLayerId: null,
        activeLayerId: null,
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
    }
    this.states.clear();
    for (const [id, state] of next) this.states.set(id, state);
  }

  setMasterLevel(deckId: string, level: number): DeckRuntimeState {
    const state = { ...this.require(deckId), masterLevel: Math.max(0, Math.min(100, level)) };
    this.states.set(deckId, state);
    return state;
  }

  setAudioLevel(deckId: string, level: number): DeckRuntimeState {
    const state = { ...this.require(deckId), audioLevel: Math.max(0, Math.min(100, level)) };
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
    const state = { ...current, listCursors };
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
    const state = { ...current, playback };
    this.states.set(deckId, state);
    return state;
  }

  setVisualLevel(deckId: string, level: number): DeckRuntimeState {
    const state = { ...this.require(deckId), visualLevel: Math.max(0, Math.min(100, level)) };
    this.states.set(deckId, state);
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
    if (this.require(deck.id).masterLevel <= 0) {
      throw new Error(`Deck "${deck.id}" is muted by M and cannot enter Program.`);
    }
    this.require(deck.id);

    const current = this.require(deck.id);
    const playback = new Map(current.playback);
    playback.set(layerId, { ...playback.get(layerId)!, playing: true });
    const state: DeckRuntimeState = {
      ...current,
      activeLayerId: layerId,
      previewLayerId: layerId,
      playback
    };

    this.states.set(deck.id, state);
    return state;
  }

  setActiveLayer(deckId: string, layerId: string): DeckRuntimeState {
    const current = this.require(deckId);
    if (!current.playback.has(layerId)) throw new Error(`Layer "${layerId}" is not registered in deck "${deckId}".`);
    const state = { ...current, activeLayerId: layerId };
    this.states.set(deckId, state);
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
