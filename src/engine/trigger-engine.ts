import type { Deck, DeckLayerRef } from "../domain/deck.js";
import { ProgramEngine, type ProgramState } from "./program-engine.js";
import { OutputEngine } from "./output-engine.js";
import { assertValidTriggerAction } from "./trigger-validator.js";

export type TriggerAction =
  | { readonly type: "program"; readonly target: DeckLayerRef }
  | { readonly type: "sequence"; readonly actions: readonly TriggerAction[] }
  | { readonly type: "set-output-enabled"; readonly outputId: string; readonly enabled: boolean }
  | { readonly type: "set-media-feature"; readonly outputId: string; readonly feature: "stream" | "record" | "virtual"; readonly enabled: boolean };

export interface TriggerContext {
  readonly decks: ReadonlyMap<string, Deck>;
  readonly program: ProgramEngine;
  readonly output?: OutputEngine;
}

/**
 * Trigger is the orchestration layer. It validates the complete action first,
 * then executes it. Program/Transition ownership remains in Program/Deck.
 */
export class TriggerEngine {
  execute(action: TriggerAction, context: TriggerContext): ProgramState {
    assertValidTriggerAction(action, context);

    if (action.type === "sequence") {
      const state = this.executeSequence(action.actions, context);
      this.syncOutputs(state, context);
      return state;
    }

    const state = this.executeAction(action, context);
    if (action.type === "program") this.syncOutputs(state, context);
    return state;
  }

  private executeSequence(
    actions: readonly TriggerAction[],
    context: TriggerContext
  ): ProgramState {
    let state = context.program.getState();

    for (const action of actions) {
      state = this.executeAction(action, context, state);
    }

    return state;
  }

  private executeAction(
    action: TriggerAction,
    context: TriggerContext,
    fallback?: ProgramState
  ): ProgramState {
    switch (action.type) {
      case "program": {
        const deck = context.decks.get(action.target.deckId);
        if (!deck) throw new Error(`Deck "${action.target.deckId}" does not exist.`);
        return context.program.program(deck, action.target.layerId);
      }

      case "sequence":
        return this.executeSequence(action.actions, context);

      case "set-output-enabled":
        if (!context.output) throw new Error("Output engine is required for output trigger actions.");
        context.output.setEnabled(action.outputId, action.enabled);
        return fallback ?? context.program.getState();

      case "set-media-feature":
        if (!context.output) throw new Error("Output engine is required for output trigger actions.");
        context.output.setMediaFeature(action.outputId, action.feature, action.enabled);
        return fallback ?? context.program.getState();
    }
  }

  private syncOutputs(state: ProgramState, context: TriggerContext): void {
    if (!context.output || !state.source) return;
    context.output.syncFromProgram(state.source, state.compositionId);
    context.output.syncFromDeck(state.source.deckId, state.source);
  }
}
