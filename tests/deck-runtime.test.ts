import { describe, expect, it } from "vitest";
import type { Deck } from "../src/domain/deck.js";
import { DeckRuntime } from "../src/engine/deck-runtime.js";

const deck: Deck = {
  id: "deck-1",
  name: "Deck 1",
  layers: [
    { id: "layer-1", name: "Layer 1" },
    { id: "layer-2", name: "Layer 2" }
  ],
  transition: { type: "fade", durationMs: 500 }
};

describe("Deck Runtime", () => {
  it("starts with no active Layer", () => {
    const runtime = new DeckRuntime();

    expect(runtime.register(deck)).toEqual({
      deckId: "deck-1",
      previewLayerId: null,
      activeLayerId: null,
      masterEnabled: true,
      audioLevel: 100,
      visualLevel: 100
    });
    expect(runtime.getActiveLayer(deck)).toBeNull();
    expect(runtime.getActiveSource(deck)).toBeNull();
  });

  it("previews a Layer without changing Program", () => {
    const runtime = new DeckRuntime();
    runtime.register(deck);

    const state = runtime.previewLayer(deck, "layer-2");

    expect(state.previewLayerId).toBe("layer-2");
    expect(state.activeLayerId).toBeNull();
    expect(runtime.getPreviewSource(deck)).toEqual({
      deckId: "deck-1",
      layerId: "layer-2"
    });
    expect(runtime.getActiveSource(deck)).toBeNull();
  });

  it("changes the Deck active Layer and exposes its source", () => {
    const runtime = new DeckRuntime();
    runtime.register(deck);

    const state = runtime.programLayer(deck, "layer-2");

    expect(state).toEqual({
      deckId: "deck-1",
      previewLayerId: "layer-2",
      activeLayerId: "layer-2",
      masterEnabled: true,
      audioLevel: 100,
      visualLevel: 100
    });
    expect(runtime.getActiveLayer(deck)?.id).toBe("layer-2");
    expect(runtime.getActiveSource(deck)).toEqual({
      deckId: "deck-1",
      layerId: "layer-2"
    });
  });

  it("rejects a Layer that does not belong to the Deck", () => {
    const runtime = new DeckRuntime();
    runtime.register(deck);

    expect(() => runtime.programLayer(deck, "layer-99")).toThrow(
      'Layer "layer-99" does not exist in deck "deck-1".'
    );
  });

  it("requires a Deck to be registered before changing its active Layer", () => {
    const runtime = new DeckRuntime();

    expect(() => runtime.programLayer(deck, "layer-1")).toThrow(
      'Deck "deck-1" is not registered.'
    );
  });

  it("clears the active Layer without changing Deck identity", () => {
    const runtime = new DeckRuntime();
    runtime.register(deck);
    runtime.programLayer(deck, "layer-2");

    expect(runtime.clearActiveLayer("deck-1")).toEqual({
      deckId: "deck-1",
      previewLayerId: "layer-2",
      activeLayerId: null,
      masterEnabled: true,
      audioLevel: 100,
      visualLevel: 100
    });
  });
});
