import type { DeckLayerRef, Transition } from "../domain/deck.js";
import type { ProgramState } from "./program-engine.js";

export interface TransitionRun {
  readonly from: DeckLayerRef | null;
  readonly to: DeckLayerRef;
  readonly transition: Transition;
  readonly startedAt: number;
}

export interface TransitionProgress {
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
  private runState: TransitionRun | null = null;

  start(previous: ProgramState, next: ProgramState, startedAt = Date.now()): TransitionRun | null {
    if (!next.source) {
      this.runState = null;
      return null;
    }

    const transition = next.transition;
    if (!transition) {
      this.runState = null;
      return null;
    }

    const run: TransitionRun = {
      from: previous.source,
      to: next.source,
      transition,
      startedAt
    };

    this.runState = run;
    return run;
  }

  sample(now = Date.now()): TransitionProgress | null {
    const run = this.runState;
    if (!run) return null;

    const duration = Math.max(0, run.transition.durationMs);
    const elapsed = Math.max(0, now - run.startedAt);
    const progress = duration === 0 ? 1 : Math.min(1, elapsed / duration);
    const active = progress < 1;

    if (!active) {
      this.runState = null;
    }

    return {
      active,
      progress,
      from: run.from,
      to: run.to,
      transition: run.transition
    };
  }

  getCurrent(): TransitionRun | null {
    return this.runState;
  }

  cancel(): TransitionRun | null {
    const current = this.runState;
    this.runState = null;
    return current;
  }
}
