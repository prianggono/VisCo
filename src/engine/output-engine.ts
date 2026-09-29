import type { DeckLayerRef } from "../domain/deck.js";
import type { Scene } from "../domain/scene.js";
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
    target = this.normalizeTarget(target);
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

  setCompositionTarget(targetId: string, compositionId: string | undefined): OutputTarget {
    const target = this.requireTarget(targetId);
    const updated: OutputTarget = compositionId === undefined
      ? (() => { const { compositionId: _compositionId, ...rest } = target; return rest; })()
      : { ...target, compositionId };
    this.targets.set(targetId, updated);
    this.states.set(targetId, { ...this.requireState(targetId), target: updated });
    return updated;
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

  updateMediaSettings(targetId: string, patch: Partial<MediaOutputSettings>): OutputTarget {
    const target = this.requireTarget(targetId);
    if (target.kind !== "media" || !target.media) throw new Error(`Output "${target.id}" is not a media output.`);
    const media: MediaOutputSettings = { ...target.media, ...patch };
    const updated: OutputTarget = { ...target, media };
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
  syncFromProgram(source: DeckLayerRef, compositionId = "default"): readonly OutputState[] {
    return [...this.states.values()]
      .filter(state => state.active && state.target.enabled && state.target.deckId === undefined && (state.target.compositionId === undefined || state.target.compositionId === compositionId))
      .map(state => this.route(state.target.id, source));
  }

  /** A Deck override is scoped to the Deck and its Composition. */
  syncFromDeck(deckId: string, currentLayer: DeckLayerRef, compositionId = "default"): readonly OutputState[] {
    if (currentLayer.deckId !== deckId) {
      throw new Error(`Layer "${currentLayer.layerId}" does not belong to deck "${deckId}".`);
    }
    return [...this.states.values()]
      .filter(state =>
        state.active &&
        state.target.enabled &&
        state.target.deckId === deckId &&
        (state.target.compositionId === undefined || state.target.compositionId === compositionId)
      )
      .map(state => this.route(state.target.id, currentLayer));
  }

  /** Route the current Program source only to the outputs selected by an active Scene. */
  syncFromScene(scene: Scene, source: DeckLayerRef): readonly OutputState[] {
    if (!scene.enabled) throw new Error(`Scene "${scene.id}" is disabled.`);

    // Scene is the routing authority. Clear other canonical outputs first so
    // switching Scene cannot leave a previous display/production route active.
    for (const state of this.states.values()) {
      if (state.active && state.target.enabled) {
        this.states.set(state.target.id, { ...state, active: false });
      }
    }
    if (scene.target.kind === "display") {
      const target = this.requireTarget(scene.target.displayId);
      if (target.compositionId !== undefined && target.compositionId !== scene.compositionId) {
        throw new Error(`Scene "${scene.id}" and output "${target.id}" belong to different compositions.`);
      }
      if (target.kind !== "display") throw new Error(`Scene "${scene.id}" targets non-display output "${target.id}".`);
      if (!target.enabled) return [];
      return [this.route(target.id, source)];
    }

    const target = this.requireTarget("production");
    if (target.kind !== "media" || !target.media) throw new Error(`Scene "${scene.id}" requires the production media output.`);
    if (target.compositionId !== undefined && target.compositionId !== scene.compositionId) {
      throw new Error(`Scene "${scene.id}" and production output belong to different compositions.`);
    }
    if (!target.enabled) return [];
    const mediaEnabled =
      (scene.target.record && target.media.recording) ||
      (scene.target.stream && target.media.streaming) ||
      (scene.target.virtual && target.media.virtual);
    return mediaEnabled ? [this.route(target.id, source)] : [];
  }

  stop(targetId: string): OutputState {
    const state = { ...this.requireState(targetId), active: false };
    this.states.set(targetId, state);
    return state;
  }

  getState(targetId: string): OutputState { return this.requireState(targetId); }
  list(): readonly OutputTarget[] { return [...this.targets.values()]; }

  /** Replace persisted output targets when a project is opened. */
  replaceAll(targets: readonly OutputTarget[]): void {
    const nextTargets = new Map<string, OutputTarget>();
    const nextStates = new Map<string, OutputState>();
    for (const rawTarget of targets) {
      const target = this.normalizeTarget(rawTarget);
      if (nextTargets.has(target.id)) throw new Error(`Output "${target.id}" is duplicated.`);
      if (target.kind === "media" && !target.media) throw new Error(`Media output "${target.id}" requires media settings.`);
      if (target.kind === "display" && target.media) throw new Error(`Display output "${target.id}" cannot have media settings.`);
      nextTargets.set(target.id, target);
      nextStates.set(target.id, { target, source: null, active: target.enabled });
    }
    this.targets.clear();
    this.states.clear();
    for (const [id, target] of nextTargets) this.targets.set(id, target);
    for (const [id, state] of nextStates) this.states.set(id, state);
  }
  getActiveStates(): readonly OutputState[] { return [...this.states.values()].filter(state => state.active); }

  private normalizeTarget(target: OutputTarget): OutputTarget {
    if (target.kind !== "media" || !target.media?.compositionId || target.compositionId !== undefined) return target;
    return { ...target, compositionId: target.media.compositionId };
  }

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
