export type AudioBus = "master" | "visco-vb";

export interface AudioRoute {
  readonly sourceId: string;
  readonly sourceBus: AudioBus;
  readonly targetBus: AudioBus;
  readonly enabled: boolean;
}

/**
 * VisCo VB is intentionally isolated from Master.
 * VB -> Master must never be created by the routing engine.
 * Master -> VB is allowed only when explicitly requested.
 */
export function canRoute(sourceBus: AudioBus, targetBus: AudioBus): boolean {
  if (sourceBus === "visco-vb" && targetBus === "master") return false;
  return true;
}

export class AudioRoutingEngine {
  private readonly routes = new Map<string, AudioRoute>();

  connect(sourceId: string, sourceBus: AudioBus, targetBus: AudioBus): AudioRoute {
    if (!canRoute(sourceBus, targetBus)) {
      throw new Error("VisCo VB cannot route into Master.");
    }

    const route: AudioRoute = {
      sourceId,
      sourceBus,
      targetBus,
      enabled: true
    };
    this.routes.set(this.key(sourceId, targetBus), route);
    return route;
  }

  disconnect(sourceId: string, targetBus: AudioBus): void {
    this.routes.delete(this.key(sourceId, targetBus));
  }

  setEnabled(sourceId: string, targetBus: AudioBus, enabled: boolean): AudioRoute {
    const route = this.routes.get(this.key(sourceId, targetBus));
    if (!route) {
      throw new Error(`Audio route "${sourceId}" -> ${targetBus} is not configured.`);
    }

    const next = { ...route, enabled };
    this.routes.set(this.key(sourceId, targetBus), next);
    return next;
  }

  getRoutes(): readonly AudioRoute[] {
    return [...this.routes.values()];
  }

  getRoutesForTarget(targetBus: AudioBus): readonly AudioRoute[] {
    return this.getRoutes().filter((route) => route.targetBus === targetBus && route.enabled);
  }

  private key(sourceId: string, targetBus: AudioBus): string {
    return `${sourceId}::${targetBus}`;
  }
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
