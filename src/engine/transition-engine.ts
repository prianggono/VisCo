import type { DeckLayerRef, Transition } from "../domain/deck.js";
import type { ProgramState } from "./program-engine.js";

export interface TransitionRun {
  readonly compositionId: string;
  readonly from: DeckLayerRef | null;
  readonly to: DeckLayerRef;
  readonly transition: Transition;
  readonly startedAt: number;
}

export interface TransitionProgress {
  readonly compositionId: string;
  readonly active: boolean;
  readonly progress: number;
  readonly from: DeckLayerRef | null;
  readonly to: DeckLayerRef;
  readonly transition: Transition;
}

/**
 * Runtime execution of the Transition owned by the target Deck.
 *
 * Transition configuration remains on Deck. This engine only owns the
 * ephemeral execution state needed to move Program from the previous
 * composition state to the new one.
 */
export class TransitionEngine {
  private readonly runStates = new Map<string, TransitionRun>();

  start(previous: ProgramState, next: ProgramState, startedAt = Date.now()): TransitionRun | null {
    const compositionId = next.compositionId;
    if (!next.source) {
      this.runStates.delete(compositionId);
      return null;
    }

    const transition = next.transition;
    if (!transition) {
      this.runStates.delete(compositionId);
      return null;
    }

    const run: TransitionRun = {
      compositionId,
      from: previous.source,
      to: next.source,
      transition,
      startedAt
    };

    this.runStates.set(compositionId, run);
    return run;
  }

  sample(compositionId = "default", now = Date.now()): TransitionProgress | null {
    const run = this.runStates.get(compositionId);
    if (!run) return null;

    const duration = Math.max(0, run.transition.durationMs);
    const elapsed = Math.max(0, now - run.startedAt);
    const progress = duration === 0 ? 1 : Math.min(1, elapsed / duration);
    const active = progress < 1;

    if (!active) {
      this.runStates.delete(compositionId);
    }

    return {
      compositionId,
      active,
      progress,
      from: run.from,
      to: run.to,
      transition: run.transition
    };
  }

  getCurrent(compositionId = "default"): TransitionRun | null {
    return this.runStates.get(compositionId) ?? null;
  }

  cancel(compositionId = "default"): TransitionRun | null {
    const current = this.runStates.get(compositionId) ?? null;
    this.runStates.delete(compositionId);
    return current;
  }
}
