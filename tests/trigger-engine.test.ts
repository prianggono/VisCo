import { describe, expect, it } from "vitest";
import { TriggerEngine, type TriggerContext } from "../src/engine/trigger-engine.js";
import { validateTriggerAction } from "../src/engine/trigger-validator.js";
import { DeckProgramController } from "../src/engine/deck-program-controller.js";
import { DeckRuntime } from "../src/engine/deck-runtime.js";
import { ProgramEngine } from "../src/engine/program-engine.js";
import { OutputEngine } from "../src/engine/output-engine.js";
import type { Deck } from "../src/domain/deck.js";

const deck: Deck = {
  id: "deck-1",
  name: "Deck 1",
  layers: [{ id: "layer-1", name: "Layer 1" }],
  transition: { type: "fade", durationMs: 100 },
  compositionId: "default"
};

function context(): TriggerContext {
  const deckRuntime = new DeckRuntime();
  deckRuntime.register(deck);
  const output = new OutputEngine();
  output.register({ id: "display", kind: "display", enabled: true });
  const controller = new DeckProgramController(deckRuntime, new ProgramEngine(), output);
  return { decks: new Map([[deck.id, deck]]), controller, output };
}

describe("trigger engine", () => {
  it("validates and executes program actions", () => {
    const ctx = context();
    const action = { type: "program" as const, target: { deckId: "deck-1", layerId: "layer-1" } };
    expect(validateTriggerAction(action, ctx).valid).toBe(true);
    const state = new TriggerEngine().execute(action, ctx);
    expect(state.source).toEqual({ deckId: "deck-1", layerId: "layer-1" });
  });

  it("allows duplicate copied actions while rejecting broken references", () => {
    const ctx = context();
    const action = {
      type: "sequence" as const,
      actions: [
        { type: "program" as const, target: { deckId: "deck-1", layerId: "layer-1" } },
        { type: "program" as const, target: { deckId: "deck-1", layerId: "layer-1" } }
      ]
    };
    expect(validateTriggerAction(action, ctx).valid).toBe(true);
    const invalid = { type: "program" as const, target: { deckId: "missing", layerId: "layer-1" } };
    expect(validateTriggerAction(invalid, ctx).valid).toBe(false);
  });
});
