import type { DeckLayerRef } from "../domain/deck.js";
import type {
  MediaOutputKind,
  OutputTarget,
  MediaOutputSettings
} from "../domain/output.js";

export type { MediaOutputKind, OutputTarget, MediaOutputSettings } from "../domain/output.js";

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
    this.states.set(target.id, { target, source: null, active: target.enabled });
  }

  setEnabled(targetId: string, enabled: boolean): OutputState {
    const target = this.requireTarget(targetId);
    const updated = { ...target, enabled };
    this.targets.set(targetId, updated);
    const state = { ...this.requireState(targetId), target: updated, active: enabled };
    this.states.set(targetId, state);
    return state;
  }

  setDeckTarget(targetId: string, deckId: string | undefined): OutputTarget {
    const target = this.requireTarget(targetId);
    const updated: OutputTarget = deckId === undefined
      ? (() => { const { deckId: _deckId, ...withoutDeck } = target; return withoutDeck; })()
      : { ...target, deckId };
    this.targets.set(targetId, updated);
    this.states.set(targetId, { ...this.requireState(targetId), target: updated });
    return updated;
  }

  setMediaFeature(targetId: string, feature: MediaOutputKind, enabled: boolean): OutputTarget {
    const target = this.requireTarget(targetId);
    if (target.kind !== "media" || !target.media) {
      throw new Error(`Output "${target.id}" is not a media output.`);
    }
    const key = feature === "stream" ? "streaming" : feature === "record" ? "recording" : "virtual";
    const media: MediaOutputSettings = { ...target.media, [key]: enabled };
    const updated: OutputTarget = { ...target, media };
    this.targets.set(targetId, updated);
    this.states.set(targetId, { ...this.requireState(targetId), target: updated });
    return updated;
  }

  route(targetId: string, source: DeckLayerRef): OutputState {
    const target = this.requireTarget(targetId);
    if (!target.enabled) throw new Error(`Output "${target.id}" is disabled.`);
    const state = { target, source, active: true };
    this.states.set(targetId, state);
    return state;
  }

  /** Program is the default source. Deck-routed outputs are not overridden. */
  syncFromProgram(source: DeckLayerRef): readonly OutputState[] {
    return [...this.states.values()]
      .filter(state => state.active && state.target.enabled && state.target.deckId === undefined)
      .map(state => this.route(state.target.id, source));
  }

  syncFromDeck(deckId: string, currentLayer: DeckLayerRef): readonly OutputState[] {
    if (currentLayer.deckId !== deckId) {
      throw new Error(`Layer "${currentLayer.layerId}" does not belong to deck "${deckId}".`);
    }
    return [...this.states.values()]
      .filter(state => state.active && state.target.enabled && state.target.deckId === deckId)
      .map(state => this.route(state.target.id, currentLayer));
  }

  stop(targetId: string): OutputState {
    const state = { ...this.requireState(targetId), active: false };
    this.states.set(targetId, state);
    return state;
  }

  getState(targetId: string): OutputState { return this.requireState(targetId); }
  getActiveStates(): readonly OutputState[] { return [...this.states.values()].filter(state => state.active); }

  private requireTarget(targetId: string): OutputTarget {
    const target = this.targets.get(targetId);
    if (!target) throw new Error(`Output "${targetId}" does not exist.`);
    return target;
  }
  private requireState(targetId: string): OutputState {
    const state = this.states.get(targetId);
    if (!state) throw new Error(`Output "${targetId}" does not exist.`);
    return state;
  }
}
