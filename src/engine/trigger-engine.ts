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
    };

export interface TriggerContext {
  readonly decks: ReadonlyMap<string, Deck>;
  readonly program: ProgramEngine;
  readonly output?: OutputEngine;
}

export class TriggerEngine {
  execute(action: TriggerAction, context: TriggerContext): ProgramState {
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
          state = this.execute(nestedAction, context);
        }
        return state;
      }
    }
  }
}
