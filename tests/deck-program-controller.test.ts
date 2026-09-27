import { describe, expect, it } from "vitest";
import type { Deck } from "../src/domain/deck.js";
import type { Group } from "../src/domain/group.js";
import { DeckRuntime } from "../src/engine/deck-runtime.js";
import { DeckProgramController } from "../src/engine/deck-program-controller.js";
import { OutputEngine } from "../src/engine/output-engine.js";
import { ProgramEngine } from "../src/engine/program-engine.js";

const deck: Deck = {
  id: "deck-1",
  name: "Deck 1",
  layers: [
    { id: "layer-1", name: "Layer 1" },
    { id: "layer-2", name: "Layer 2" },
    { id: "layer-3", name: "Layer 3" }
  ],
  transition: { type: "fade", durationMs: 500 }
};

describe("Deck click -> Preview / Program -> Output", () => {
  it("clicking a Layer name previews without changing Program or Output", () => {
    const program = new ProgramEngine();
    program.program(deck, "layer-1");

    const output = new Map([["display-main", { source: { deckId: "deck-1", layerId: "layer-1" } }]]);

    const runtime = new DeckRuntime();
    runtime.register(deck);
    const controller = new DeckProgramController(runtime, program);

    const state = controller.preview(deck, "layer-2");

    expect(state.previewLayerId).toBe("layer-2");
    expect(state.activeLayerId).toBeNull();
    expect(program.getState().source).toEqual({
      deckId: "deck-1",
      layerId: "layer-1"
    });
    expect(output.get("display-main")?.source).toEqual({
      deckId: "deck-1",
      layerId: "layer-1"
    });
  });

  it("reads Program state from the Deck composition", () => {
    const venueDeck: Deck = { ...deck, id: "venue-deck" };
    const runtime = new DeckRuntime();
    runtime.register(venueDeck);
    const program = new ProgramEngine();
    program.program(venueDeck, "layer-1", "venue");
    const controller = new DeckProgramController(runtime, program);

    expect(controller.getState(venueDeck).program.source).toEqual({
      deckId: "venue-deck",
      layerId: "layer-1"
    });
    expect(controller.getState(venueDeck).program.compositionId).toBe("venue");
  });

  it("clicking a Layer box programs immediately and syncs outputs", () => {
    const runtime = new DeckRuntime();
    runtime.register(deck);

    const program = new ProgramEngine();
    const controller = new DeckProgramController(runtime, program);
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
    expect(program.getState().source).toEqual({
      deckId: "deck-1",
      layerId: "layer-2"
    });
  });

  it("programs a Group as an ordered multi-Layer formasi", () => {
    const group: Group = {
      id: "group-1",
      name: "Camera + PPT + Camera",
      deckId: "deck-1",
      layerIds: ["layer-3", "layer-1", "layer-2"],
      collapsed: false
    };

    const runtime = new DeckRuntime();
    runtime.register(deck);
    const program = new ProgramEngine();
    const controller = new DeckProgramController(runtime, program);

    const state = controller.programGroup(deck, group, );

    expect(state.deck.activeLayerIds).toEqual([
      "layer-3",
      "layer-1",
      "layer-2"
    ]);
    expect(state.program.layers.map(({ source }) => source)).toEqual([
      { deckId: "deck-1", layerId: "layer-3" },
      { deckId: "deck-1", layerId: "layer-1" },
      { deckId: "deck-1", layerId: "layer-2" }
    ]);
    expect(state.program.transition).toEqual({
      type: "fade",
      durationMs: 500
    });
  });

  it("rejects a Group that belongs to another Deck", () => {
    const group: Group = {
      id: "group-other",
      name: "Other",
      deckId: "deck-2",
      layerIds: ["layer-1"],
      collapsed: false
    };

    const runtime = new DeckRuntime();
    runtime.register(deck);
    const program = new ProgramEngine();
    const controller = new DeckProgramController(runtime, program);

    expect(() =>
      controller.programGroup(deck, group, { syncOutputs: false })
    ).toThrow('belongs to deck "deck-2", not "deck-1"');
  });

  it("keeps M gating for Group Program", () => {
    const mutedDeck: Deck = {
      ...deck,
      masterLevel: 0
    };
    const group: Group = {
      id: "group-muted",
      name: "Muted",
      deckId: "deck-1",
      layerIds: ["layer-1", "layer-2"],
      collapsed: false
    };

    const runtime = new DeckRuntime();
    runtime.register(mutedDeck);
    const program = new ProgramEngine();
    const controller = new DeckProgramController(runtime, program);

    expect(() =>
      controller.programGroup(mutedDeck, group, { syncOutputs: false })
    ).toThrow('muted by M');
  });

  it("keeps audio Deck out of visual Program", () => {
    const audioDeck = {
      ...deck,
      id: "audio-deck",
      kind: "audio" as const
    };
    const group: Group = {
      id: "group-audio",
      name: "Audio",
      deckId: "audio-deck",
      layerIds: ["layer-1", "layer-2"],
      collapsed: false
    };

    const runtime = new DeckRuntime();
    runtime.register(audioDeck);
    const program = new ProgramEngine();
    const controller = new DeckProgramController(runtime, program);

    expect(() =>
      controller.programGroup(audioDeck, group, { syncOutputs: false })
    ).toThrow('cannot enter visual Program');
  });
});
