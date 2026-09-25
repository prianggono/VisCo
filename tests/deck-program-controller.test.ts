import { describe, expect, it } from "vitest";
import type { Deck } from "../src/domain/deck.js";
import { DeckRuntime } from "../src/engine/deck-runtime.js";
import { DeckProgramController } from "../src/engine/deck-program-controller.js";
import { OutputEngine } from "../src/engine/output-engine.js";
import { ProgramEngine } from "../src/engine/program-engine.js";

const deck: Deck = {
  id: "deck-1",
  name: "Deck 1",
  layers: [
    { id: "layer-1", name: "Layer 1" },
    { id: "layer-2", name: "Layer 2" }
  ],
  transition: { type: "fade", durationMs: 500 }
};

describe("Deck click -> Preview / Program -> Output", () => {
  it("clicking a Layer name previews without changing Program or Output", () => {
    const program = new ProgramEngine();
    program.program(deck, "layer-1");

    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true
    });
    output.syncFromProgram({ deckId: "deck-1", layerId: "layer-1" });

    const controller = new DeckProgramController(
      new DeckRuntime(),
      program,
      output
    );
    controller["deckRuntime"].register(deck);

    const state = controller.preview(deck, "layer-2");

    expect(state.previewLayerId).toBe("layer-2");
    expect(state.activeLayerId).toBeNull();
    expect(program.getState().source).toEqual({
      deckId: "deck-1",
      layerId: "layer-1"
    });
    expect(output.getState("display-main").source).toEqual({
      deckId: "deck-1",
      layerId: "layer-1"
    });
  });

  it("clicking a Layer box programs immediately and syncs outputs", () => {
    const runtime = new DeckRuntime();
    runtime.register(deck);

    const program = new ProgramEngine();
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true
    });

    const controller = new DeckProgramController(runtime, program, output);
    const state = controller.program(deck, "layer-2");

    expect(state.deck.activeLayerId).toBe("layer-2");
    expect(state.program.source).toEqual({
      deckId: "deck-1",
      layerId: "layer-2"
    });
    expect(state.program.transition).toEqual({
      type: "fade",
      durationMs: 500
    });
    expect(output.getState("display-main").source).toEqual({
      deckId: "deck-1",
      layerId: "layer-2"
    });
  });
});
