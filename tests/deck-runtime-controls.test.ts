import { describe, expect, it } from "vitest";
import type { Deck } from "../src/domain/deck.js";
import { DeckRuntime } from "../src/engine/deck-runtime.js";
import { ProgramEngine } from "../src/engine/program-engine.js";

const deck: Deck = {
  id: "deck-m",
  name: "Muted Deck",
  layers: [{ id: "layer-1", name: "Layer 1" }],
  masterEnabled: false,
  transition: { type: "fade", durationMs: 500 }
};

describe("Deck M gate", () => {
  it("allows Preview while M is OFF", () => {
    const runtime = new DeckRuntime();
    runtime.register(deck);
    expect(runtime.previewLayer(deck, "layer-1").previewLayerId).toBe("layer-1");
  });

  it("blocks Program while M is OFF", () => {
    const program = new ProgramEngine();
    expect(() => program.program(deck, "layer-1")).toThrow(
      'Deck "deck-m" is muted by M and cannot enter Program.'
    );
  });

  it("X deselects active layer without clearing Preview", () => {
    const runtime = new DeckRuntime();
    runtime.register({ ...deck, masterEnabled: true });
    runtime.programLayer({ ...deck, masterEnabled: true }, "layer-1");
    const state = runtime.deselectActiveLayer("deck-m");
    expect(state.activeLayerId).toBeNull();
    expect(state.previewLayerId).toBe("layer-1");
  });
});
