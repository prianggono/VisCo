import type { Deck, DeckLayerRef } from "../domain/deck.js";
import { ProgramEngine, type ProgramState } from "./program-engine.js";
import { OutputEngine } from "./output-engine.js";

export type TriggerAction =
  | {
      readonly type: "take";
      readonly target: DeckLayerRef;
    }
  | {
      readonly type: "sequence";
      readonly actions: readonly TriggerAction[];
    }
  | {
      readonly type: "set-output-enabled";
      readonly outputId: string;
      readonly enabled: boolean;
    }
  | {
      readonly type: "set-media-feature";
      readonly outputId: string;
      readonly feature: "stream" | "record" | "virtual";
      readonly enabled: boolean;
    };

export interface TriggerContext {
  readonly decks: ReadonlyMap<string, Deck>;
  readonly program: ProgramEngine;
  readonly output?: OutputEngine;
}

export class TriggerEngine {
  execute(action: TriggerAction, context: TriggerContext): ProgramState {
    const state = this.executeAction(action, context);

    if (context.output && action.type === "sequence") {
      const source = state.source;
      if (source) {
        context.output.syncFromProgram(source);
        context.output.syncFromDeck(source.deckId, source);
      }
    }

    return state;
  }

  private executeAction(
    action: TriggerAction,
    context: TriggerContext
  ): ProgramState {
    switch (action.type) {
      case "take": {
        const deck = context.decks.get(action.target.deckId);
        if (!deck) {
          throw new Error(`Deck "${action.target.deckId}" does not exist.`);
        }

        const state = context.program.take(deck, action.target.layerId);

        if (context.output) {
          context.output.syncFromProgram(action.target);
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
        if (!context.output) {
          throw new Error("Output engine is required for output trigger actions.");
        }
        context.output.setEnabled(action.outputId, action.enabled);
        return context.program.getState();

      case "set-media-feature":
        if (!context.output) {
          throw new Error("Output engine is required for output trigger actions.");
        }
        context.output.setMediaFeature(
          action.outputId,
          action.feature,
          action.enabled
        );
        return context.program.getState();
    }
  }

  private executeSequenceAction(
    action: TriggerAction,
    context: TriggerContext
  ): ProgramState {
    switch (action.type) {
      case "take": {
        const deck = context.decks.get(action.target.deckId);
        if (!deck) {
          throw new Error(`Deck "${action.target.deckId}" does not exist.`);
        }
        return context.program.take(deck, action.target.layerId);
      }

      case "sequence": {
        let state = context.program.getState();
        for (const nestedAction of action.actions) {
          state = this.executeSequenceAction(nestedAction, context);
        }
        return state;
      }

      case "set-output-enabled":
        context.output?.setEnabled(action.outputId, action.enabled);
        return context.program.getState();

      case "set-media-feature":
        context.output?.setMediaFeature(
          action.outputId,
          action.feature,
          action.enabled
        );
        return context.program.getState();
    }
  }
}
