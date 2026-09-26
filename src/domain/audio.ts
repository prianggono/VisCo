export type AudioBus = "master" | "visco-vb";

export interface AudioRoute {
  readonly sourceId: string;
  readonly bus: AudioBus;
  readonly enabled: boolean;
}

/**
 * VisCo VB is intentionally isolated from Master.
 * VB -> Master must never be created by the routing engine.
 */
export function canRoute(sourceBus: AudioBus, targetBus: AudioBus): boolean {
  if (sourceBus === "visco-vb" && targetBus === "master") return false;
  return true;
}


export interface AudioDeckState {
  readonly deckId: string;
  readonly enabled: boolean;
  readonly level: number;
  readonly layerId: string | null;
}

export class AudioEngine {
  private readonly decks = new Map<string, AudioDeckState>();

  registerDeck(deckId: string): AudioDeckState {
    if (this.decks.has(deckId)) throw new Error(`Audio deck "${deckId}" is already registered.`);
    const state = { deckId, enabled: true, level: 100, layerId: null };
    this.decks.set(deckId, state);
    return state;
  }

  setEnabled(deckId: string, enabled: boolean): AudioDeckState {
    const state = this.require(deckId);
    const next = { ...state, enabled };
    this.decks.set(deckId, next);
    return next;
  }

  setLevel(deckId: string, level: number): AudioDeckState {
    const state = this.require(deckId);
    const next = { ...state, level: Math.max(0, Math.min(100, level)) };
    this.decks.set(deckId, next);
    return next;
  }

  selectLayer(deckId: string, layerId: string | null): AudioDeckState {
    const state = this.require(deckId);
    const next = { ...state, layerId };
    this.decks.set(deckId, next);
    return next;
  }

  getState(deckId: string): AudioDeckState {
    return this.require(deckId);
  }

  getActiveLayers(): readonly AudioDeckState[] {
    return [...this.decks.values()].filter((state) => state.enabled && state.layerId !== null);
  }

  private require(deckId: string): AudioDeckState {
    const state = this.decks.get(deckId);
    if (!state) throw new Error(`Audio deck "${deckId}" is not registered.`);
    return state;
  }
}
