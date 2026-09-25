import type { DeckLayerRef } from "../domain/deck.js";

export type OutputKind = "display" | "media";
export type MediaOutputKind = "stream" | "record" | "virtual";

export interface MediaOutputSettings {
  readonly resolution: readonly [width: number, height: number];
  readonly fps: number;
  readonly streaming: boolean;
  readonly recording: boolean;
  readonly virtual: boolean;
}

export interface OutputTarget {
  readonly id: string;
  readonly kind: OutputKind;
  readonly enabled: boolean;
  /**
   * Outputs are routed by Deck only. The currently active layer of that Deck
   * is always carried with the output automatically.
   */
  readonly deckId?: string;
  /**
   * Stream, Record and Virtual Out share one render pipeline and one
   * resolution/FPS configuration.
   */
  readonly media?: MediaOutputSettings;
}

export interface OutputState {
  readonly target: OutputTarget;
  readonly source: DeckLayerRef | null;
  readonly active: boolean;
}

export class OutputEngine {
  private readonly targets = new Map<string, OutputTarget>();
  private readonly states = new Map<string, OutputState>();

  register(target: OutputTarget): void {
    if (this.targets.has(target.id)) {
      throw new Error(`Output "${target.id}" is already registered.`);
    }

    if (target.kind === "media" && !target.media) {
      throw new Error(`Media output "${target.id}" requires media settings.`);
    }

    if (target.kind === "display" && target.media) {
      throw new Error(`Display output "${target.id}" cannot have media settings.`);
    }

    this.targets.set(target.id, target);
    this.states.set(target.id, { target, source: null, active: false });
  }

  setEnabled(targetId: string, enabled: boolean): OutputState {
    const target = this.requireTarget(targetId);
    const updated = { ...target, enabled };
    this.targets.set(targetId, updated);

    const current = this.requireState(targetId);
    const state = {
      ...current,
      target: updated,
      active: enabled && current.active
    };
    this.states.set(targetId, state);
    return state;
  }

  setDeckTarget(targetId: string, deckId: string | undefined): OutputTarget {
    const target = this.requireTarget(targetId);
    const updated: OutputTarget = deckId === undefined
      ? { ...target, deckId: undefined }
      : { ...target, deckId };

    this.targets.set(targetId, updated);
    this.states.set(targetId, { ...this.requireState(targetId), target: updated });
    return updated;
  }

  setMediaFeature(
    targetId: string,
    feature: MediaOutputKind,
    enabled: boolean
  ): OutputTarget {
    const target = this.requireTarget(targetId);

    if (target.kind !== "media" || !target.media) {
      throw new Error(`Output "${target.id}" is not a media output.`);
    }

    const media = {
      ...target.media,
      [feature === "stream" ? "streaming" : feature === "record" ? "recording" : "virtual"]: enabled
    };

    const updated: OutputTarget = { ...target, media };
    this.targets.set(targetId, updated);
    this.states.set(targetId, { ...this.requireState(targetId), target: updated });
    return updated;
  }

  route(targetId: string, source: DeckLayerRef): OutputState {
    const target = this.requireTarget(targetId);
    if (!target.enabled) {
      throw new Error(`Output "${target.id}" is disabled.`);
    }

    const state = { target, source, active: true };
    this.states.set(targetId, state);
    return state;
  }

  syncFromDeck(
    deckId: string,
    currentLayer: DeckLayerRef
  ): readonly OutputState[] {
    if (currentLayer.deckId !== deckId) {
      throw new Error(
        `Layer "${currentLayer.layerId}" does not belong to deck "${deckId}".`
      );
    }

    const ids = [...this.states.values()]
      .filter(
        (state) =>
          state.active &&
          state.target.enabled &&
          state.target.deckId === deckId
      )
      .map((state) => state.target.id);

    return ids.map((id) => this.route(id, currentLayer));
  }

  stop(targetId: string): OutputState {
    const state = { ...this.requireState(targetId), active: false };
    this.states.set(targetId, state);
    return state;
  }

  getState(targetId: string): OutputState {
    return this.requireState(targetId);
  }

  getActiveStates(): readonly OutputState[] {
    return [...this.states.values()].filter((state) => state.active);
  }

  private requireTarget(targetId: string): OutputTarget {
    const target = this.targets.get(targetId);
    if (!target) {
      throw new Error(`Output "${targetId}" does not exist.`);
    }
    return target;
  }

  private requireState(targetId: string): OutputState {
    const state = this.states.get(targetId);
    if (!state) {
      throw new Error(`Output "${targetId}" does not exist.`);
    }
    return state;
  }
}
