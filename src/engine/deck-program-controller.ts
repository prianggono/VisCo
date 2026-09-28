import type { Deck } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import { DeckRuntime, type DeckRuntimeState } from "./deck-runtime.js";
import { resolveGroupLayers } from "./group-resolver.js";
import { ProgramEngine, type ProgramState } from "./program-engine.js";
import { TransitionEngine, type TransitionProgress } from "./transition-engine.js";

export interface DeckProgramControllerState {
  readonly deck: DeckRuntimeState;
  readonly program: ProgramState;
}

export interface DeckProgramOptions {
  readonly compositionId?: string;
}

export class DeckProgramController {
  constructor(
    private readonly deckRuntime: DeckRuntime,
    private readonly programEngine: ProgramEngine
  ) {}

  preview(deck: Deck, layerId: string): DeckRuntimeState {
    return this.deckRuntime.previewLayer(deck, layerId);
  }

  program(deck: Deck, layerId: string, options: DeckProgramOptions = {}): DeckProgramControllerState {
    return this.programLayers(deck, [layerId], options);
  }

  /**
   * Programs the ordered Layer formasi defined by a Deck-owned Group.
   *
   * Group owns membership/order only. Transition remains owned by Deck.
   * Output routing is handled by the Composition/Output pipeline, not by this controller.
   */
  programGroup(deck: Deck, group: Group, options: DeckProgramOptions = {}): DeckProgramControllerState {
    const resolved = resolveGroupLayers(deck, group);
    return this.programLayers(
      deck,
      resolved.map(({ ref }) => ref.layerId),
      options
    );
  }

  private programLayers(
    deck: Deck,
    layerIds: readonly string[],
    options: DeckProgramOptions
  ): DeckProgramControllerState {
    if ((deck as Deck & { kind?: "visual" | "audio" }).kind === "audio") {
      throw new Error(`Audio deck "${deck.id}" cannot enter visual Program.`);
    }

    // Validate the runtime Deck first so ProgramEngine cannot mutate its
    // composition-scoped state when the Deck is not registered.
    const currentDeckState = this.deckRuntime.getState(deck.id);

    // Runtime M is authoritative for the live Deck. Pass that state to Program
    // so the UI fader and Program gate cannot disagree.
    const runtimeDeck: Deck = { ...deck, masterLevel: currentDeckState.masterLevel };
    const programState = this.programEngine.programLayers(
      runtimeDeck,
      layerIds,
      options.compositionId ?? "default"
    );

    // ProgramEngine validation has completed before Runtime mutation. The
    // remaining Runtime operation uses the same Deck/layer inputs.
    const deckState = this.deckRuntime.programLayers(deck, layerIds);

    return { deck: deckState, program: programState };
  }

  getProgramState(compositionId = "default"): ProgramState {
    return this.programEngine.getState(compositionId);
  }

  getState(deck: Deck): DeckProgramControllerState;
  getState(deckId: string): DeckProgramControllerState;
  getState(deckOrId: Deck | string): DeckProgramControllerState {
    const deckId = typeof deckOrId === "string" ? deckOrId : deckOrId.id;
    const compositionId = "default";
    return {
      deck: this.deckRuntime.getState(deckId),
      program: this.programEngine.getState(compositionId)
    };
  }
}
