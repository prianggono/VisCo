import type { Deck } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import { DeckRuntime, type DeckRuntimeState } from "./deck-runtime.js";
import { resolveGroupLayers } from "./group-resolver.js";
import { ProgramEngine, type ProgramState } from "./program-engine.js";
import { TransitionEngine, type TransitionProgress } from "./transition-engine.js";

export interface DeckProgramControllerState {
  readonly deck: DeckRuntimeState;
  readonly program: ProgramState;
  readonly transition: TransitionProgress | null;
}

export interface DeckProgramOptions {
  readonly compositionId?: string;
}

export class DeckProgramController {
  constructor(
    private readonly deckRuntime: DeckRuntime,
    private readonly programEngine: ProgramEngine,
    private readonly transitionEngine: TransitionEngine = new TransitionEngine()
  ) {}

  preview(deck: Deck, layerId: string): DeckRuntimeState {
    return this.deckRuntime.previewLayer(deck, layerId);
  }

  program(deck: Deck, layerId: string, options: DeckProgramOptions = {}): DeckProgramControllerState {
    return this.programLayers(deck, [layerId], options);
  }

  programGroup(deck: Deck, group: Group, options: DeckProgramOptions = {}): DeckProgramControllerState {
    const resolved = resolveGroupLayers(deck, group);
    return this.programLayers(deck, resolved.map(({ ref }) => ref.layerId), options);
  }

  private programLayers(
    deck: Deck,
    layerIds: readonly string[],
    options: DeckProgramOptions
  ): DeckProgramControllerState {
    if ((deck as Deck & { kind?: "visual" | "audio" }).kind === "audio") {
      throw new Error(`Audio deck "${deck.id}" cannot enter visual Program.`);
    }

    const currentDeckState = this.deckRuntime.getState(deck.id);
    const runtimeDeck: Deck = { ...deck, masterLevel: currentDeckState.masterLevel };
    const compositionId = options.compositionId ?? "default";
    const previousProgram = this.programEngine.getState(compositionId);

    const programState = this.programEngine.programLayers(
      runtimeDeck,
      layerIds,
      compositionId
    );

    const deckState = this.deckRuntime.programLayers(deck, layerIds);

    this.transitionEngine.start(previousProgram, programState);
    const transition = this.transitionEngine.sample(compositionId);

    return {
      deck: deckState,
      program: programState,
      transition
    };
  }

  getProgramState(compositionId = "default"): ProgramState {
    return this.programEngine.getState(compositionId);
  }

  getTransitionState(): TransitionProgress | null {
    return this.transitionEngine.sample(compositionId);
  }

  getState(deck: Deck): DeckProgramControllerState;
  getState(deckId: string): DeckProgramControllerState;
  getState(deckOrId: Deck | string): DeckProgramControllerState {
    const deckId = typeof deckOrId === "string" ? deckOrId : deckOrId.id;
    const compositionId = "default";
    return {
      deck: this.deckRuntime.getState(deckId),
      program: this.programEngine.getState(compositionId),
      transition: this.transitionEngine.sample()
    };
  }
}
