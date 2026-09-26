export type AudioBus = "audio-in" | "master" | "visco-vb" | "record" | "stream" | "zoom";

export type AudioDestination = "record" | "stream" | "zoom";

export interface AudioRoute {
  readonly sourceId: string;
  readonly sourceBus: AudioBus;
  readonly targetBus: AudioBus;
  readonly enabled: boolean;
}

export interface AudioMonitoringState {
  readonly sourceId: string;
  readonly bus: AudioBus;
  readonly signalPresent: boolean;
}

/**
 * Canonical external audio path:
 * Sound Card Input -> Audio In -> VisCo VB -> Record / Stream / Zoom.
 *
 * Monitoring is diagnostic only. It observes signal state and never becomes
 * part of the audio signal path.
 */
export function canRoute(sourceBus: AudioBus, targetBus: AudioBus): boolean {
  if (sourceBus === "audio-in" && targetBus === "visco-vb") return true;
  if (sourceBus === "visco-vb" && (targetBus === "record" || targetBus === "stream" || targetBus === "zoom")) {
    return true;
  }
  return false;
}

export class AudioRoutingEngine {
  private readonly routes = new Map<string, AudioRoute>();
  private readonly monitoring = new Map<string, AudioMonitoringState>();

  connect(sourceId: string, sourceBus: AudioBus, targetBus: AudioBus): AudioRoute {
    if (!canRoute(sourceBus, targetBus)) {
      throw new Error(`Audio route "${sourceBus}" -> "${targetBus}" is not allowed.`);
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

  setSignalPresent(sourceId: string, bus: AudioBus, signalPresent: boolean): AudioMonitoringState {
    const state = { sourceId, bus, signalPresent };
    this.monitoring.set(this.key(sourceId, bus), state);
    return state;
  }

  getSignalState(sourceId: string, bus: AudioBus): AudioMonitoringState | null {
    return this.monitoring.get(this.key(sourceId, bus)) ?? null;
  }

  getRoutes(): readonly AudioRoute[] {
    return [...this.routes.values()];
  }

  getRoutesForTarget(targetBus: AudioBus): readonly AudioRoute[] {
    return this.getRoutes().filter((route) => route.targetBus === targetBus && route.enabled);
  }

  getDestinationsFromVb(): readonly AudioDestination[] {
    return this.getRoutesForTarget("visco-vb")
      .map((route) => route.targetBus)
      .filter((target): target is AudioDestination =>
        target === "record" || target === "stream" || target === "zoom"
      );
  }

  private key(sourceId: string, bus: AudioBus): string {
    return `${sourceId}::${bus}`;
  }
}

export interface AudioDeckState {
  readonly deckId: string;
  readonly enabled: boolean;
  readonly level: number;
  readonly layerId: string | null;
}

export interface MasterAudioSource {
  readonly deckId: string;
  readonly layerId: string;
  readonly gain: number;
}

export interface MasterAudioMix {
  readonly sources: readonly MasterAudioSource[];
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

  getMasterMix(): MasterAudioMix {
    const sources = this.getActiveLayers().flatMap((state) =>
      state.layerId === null
        ? []
        : [{
            deckId: state.deckId,
            layerId: state.layerId,
            gain: state.level / 100
          }]
    );

    return { sources };
  }

  private require(deckId: string): AudioDeckState {
    const state = this.decks.get(deckId);
    if (!state) throw new Error(`Audio deck "${deckId}" is not registered.`);
    return state;
  }
}
