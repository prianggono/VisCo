import type { DeckLayerRef } from "../domain/deck.js";
import type { MediaOutputKind, OutputTarget, MediaOutputSettings } from "../domain/output.js";
import type { RenderedCompositionLayer } from "./composition-renderer.js";
import type { TransitionProgress } from "./transition-engine.js";

export type { MediaOutputKind, OutputTarget, MediaOutputSettings } from "../domain/output.js";

export interface OutputState {
  readonly target: OutputTarget;
  /** Compatibility routing reference for Deck/Layer-scoped outputs. */
  readonly source: DeckLayerRef | null;
  /** Current canonical Composition render result. */
  readonly renderPlan: readonly RenderedCompositionLayer[] | null;
  /** Previous render result retained only while a transition is being rendered. */
  readonly previousRenderPlan: readonly RenderedCompositionLayer[] | null;
  /** Ephemeral Deck-owned transition currently being rendered, if any. */
  readonly transition: TransitionProgress | null;
  readonly active: boolean;
}

export class OutputEngine {
  private readonly targets = new Map<string, OutputTarget>();
  private readonly states = new Map<string, OutputState>();

  register(target: OutputTarget): void {
    if (this.targets.has(target.id)) throw new Error(`Output "${target.id}" is already registered.`);
    if (target.kind === "media" && !target.media) throw new Error(`Media output "${target.id}" requires media settings.`);
    if (target.kind === "display" && target.media) throw new Error(`Display output "${target.id}" cannot have media settings.`);
    this.targets.set(target.id, target);
    this.states.set(target.id, {
      target,
      source: null,
      renderPlan: null,
      previousRenderPlan: null,
      transition: null,
      active: target.enabled
    });
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
    this.states.set(targetId, {
      ...this.requireState(targetId),
      target: updated,
      source: null,
      renderPlan: null,
      previousRenderPlan: null,
      transition: null,
      active: this.requireState(targetId).active
    });
    return updated;
  }

  setDeckTarget(targetId: string, deckId: string | undefined): OutputTarget {
    const target = this.requireTarget(targetId);
    const updated: OutputTarget = deckId === undefined
      ? (() => { const { deckId: _deckId, ...withoutDeck } = target; return withoutDeck; })()
      : { ...target, deckId };
    this.targets.set(targetId, updated);
    this.states.set(targetId, {
      ...this.requireState(targetId),
      target: updated,
      source: null,
      renderPlan: null,
      previousRenderPlan: null,
      transition: null,
      active: this.requireState(targetId).active
    });
    return updated;
  }

  setMediaFeature(targetId: string, feature: MediaOutputKind, enabled: boolean): OutputTarget {
    const target = this.requireTarget(targetId);
    if (target.kind !== "media" || !target.media) throw new Error(`Output "${target.id}" is not a media output.`);
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
    const state = {
      ...this.requireState(targetId),
      target,
      source,
      renderPlan: null,
      previousRenderPlan: null,
      transition: null,
      active: true
    };
    this.states.set(targetId, state);
    return state;
  }

  /** Legacy Program source routing. Deck-routed outputs are not overridden. */
  syncFromProgram(source: DeckLayerRef, compositionId = "default"): readonly OutputState[] {
    return [...this.states.values()]
      .filter(state => state.active && state.target.enabled && state.target.deckId === undefined &&
        (state.target.compositionId === undefined || state.target.compositionId === compositionId))
      .map(state => this.route(state.target.id, source));
  }

  /**
   * Composition is the canonical visual result for physical/media outputs.
   * The previous plan is retained so the renderer can execute Deck transitions.
   */
  syncFromComposition(
    renderPlan: readonly RenderedCompositionLayer[],
    compositionId = "default",
    transition: TransitionProgress | null = null
  ): readonly OutputState[] {
    return [...this.states.values()]
      .filter(state => state.active && state.target.enabled && state.target.deckId === undefined &&
        (state.target.compositionId === undefined || state.target.compositionId === compositionId))
      .map(state => {
        const updated = {
          ...state,
          source: null,
          previousRenderPlan: state.renderPlan,
          renderPlan,
          transition,
          active: true
        };
        this.states.set(state.target.id, updated);
        return updated;
      });
  }

  /** A Deck override is scoped to the Deck and its Composition. */
  syncFromDeck(
    deckId: string,
    currentLayer: DeckLayerRef,
    compositionId = "default",
    transition: TransitionProgress | null = null
  ): readonly OutputState[] {
    if (currentLayer.deckId !== deckId) {
      throw new Error(`Layer "${currentLayer.layerId}" does not belong to deck "${deckId}".`);
    }
    return [...this.states.values()]
      .filter(state => state.active && state.target.enabled && state.target.deckId === deckId &&
        (state.target.compositionId === undefined || state.target.compositionId === compositionId))
      .map(state => {
        const routed = this.route(state.target.id, currentLayer);
        const updated = { ...routed, transition };
        this.states.set(state.target.id, updated);
        return updated;
      });
  }

  setTransition(targetId: string, transition: TransitionProgress | null): OutputState {
    const state = { ...this.requireState(targetId), transition };
    this.states.set(targetId, state);
    return state;
  }

  stop(targetId: string): OutputState {
    const state = { ...this.requireState(targetId), transition: null, active: false };
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
