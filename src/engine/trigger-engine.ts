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

export class TriggerEngine {
  execute(action: TriggerAction, context: TriggerContext): ProgramState {
    assertValidTriggerAction(action, context);
    const state = this.executeAction(action, context);

    if (context.output && action.type === "sequence" && state.source) {
      context.output.syncFromProgram(state.source, state.compositionId);
      context.output.syncFromDeck(state.source.deckId, state.source);
    }

    return state;
  }

  private executeAction(action: TriggerAction, context: TriggerContext): ProgramState {
    switch (action.type) {
      case "program": {
        const deck = context.decks.get(action.target.deckId);
        if (!deck) throw new Error(`Deck "${action.target.deckId}" does not exist.`);

        const state = context.program.program(deck, action.target.layerId);
        if (context.output) {
          context.output.syncFromProgram(action.target, state.compositionId);
          context.output.syncFromDeck(deck.id, action.target);
        }
        return state;
      }
      case "sequence": {
        let state = context.program.getState();
        for (const nestedAction of action.actions) {
          state = this.executeSequenceAction(nestedAction, context);
        }
        return state;
      }
      case "set-output-enabled":
        if (!context.output) throw new Error("Output engine is required for output trigger actions.");
        context.output.setEnabled(action.outputId, action.enabled);
        return context.program.getState();
      case "set-media-feature":
        if (!context.output) throw new Error("Output engine is required for output trigger actions.");
        context.output.setMediaFeature(action.outputId, action.feature, action.enabled);
        return context.program.getState();
    }
  }

  private executeSequenceAction(action: TriggerAction, context: TriggerContext): ProgramState {
    switch (action.type) {
      case "program": {
        const deck = context.decks.get(action.target.deckId);
        if (!deck) throw new Error(`Deck "${action.target.deckId}" does not exist.`);
        return context.program.program(deck, action.target.layerId);
      }
      case "sequence": {
        let state = context.program.getState();
        for (const nestedAction of action.actions) state = this.executeSequenceAction(nestedAction, context);
        return state;
      }
      case "set-output-enabled":
        context.output?.setEnabled(action.outputId, action.enabled);
        return context.program.getState();
      case "set-media-feature":
        context.output?.setMediaFeature(action.outputId, action.feature, action.enabled);
        return context.program.getState();
    }
  }
}
