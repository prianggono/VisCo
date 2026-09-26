import type { Deck } from "../domain/deck.js";
import { DeckRuntime, type DeckRuntimeState } from "./deck-runtime.js";
import { OutputEngine } from "./output-engine.js";
import { ProgramEngine, type ProgramState } from "./program-engine.js";

export interface DeckProgramControllerState {
  readonly deck: DeckRuntimeState;
  readonly program: ProgramState;
}

export class DeckProgramController {
  constructor(
    private readonly deckRuntime: DeckRuntime,
    private readonly programEngine: ProgramEngine,
    private readonly outputEngine?: OutputEngine
  ) {}

  preview(deck: Deck, layerId: string): DeckRuntimeState {
    return this.deckRuntime.previewLayer(deck, layerId);
  }

  program(deck: Deck, layerId: string): DeckProgramControllerState {
    if ((deck as Deck & { kind?: "visual" | "audio" }).kind === "audio") {
      throw new Error(`Audio deck "${deck.id}" cannot enter visual Program.`);
    }
    const deckState = this.deckRuntime.programLayer(deck, layerId);
    const programState = this.programEngine.program(deck, layerId);

    if (this.outputEngine && programState.source) {
      this.outputEngine.syncFromProgram(programState.source, programState.compositionId);
      this.outputEngine.syncFromDeck(deck.id, programState.source);
    }

    return { deck: deckState, program: programState };
  }

  getState(deck: Deck): DeckProgramControllerState;
  getState(deckId: string): DeckProgramControllerState;
  getState(deckOrId: Deck | string): DeckProgramControllerState {
    const deckId = typeof deckOrId === "string" ? deckOrId : deckOrId.id;
    const compositionId = typeof deckOrId === "string" ? "default" : deckOrId.compositionId ?? "default";
    return {
      deck: this.deckRuntime.getState(deckId),
      program: this.programEngine.getState(compositionId)
    };
  }
}
