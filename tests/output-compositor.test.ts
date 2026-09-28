import { describe, expect, it } from "vitest";
import { compositeProgramForOutput } from "../src/engine/output-compositor.js";
import type { ProgramState } from "../src/engine/program-engine.js";

describe("output compositor", () => {
  it("preserves all active Program layers for output", () => {
    const program: ProgramState = {
      compositionId: "composition-1",
      layers: [
        {
          source: { deckId: "deck-1", layerId: "layer-1" },
          layer: { id: "layer-1", name: "Layer 1" }
        },
        {
          source: { deckId: "deck-1", layerId: "layer-2" },
          layer: { id: "layer-2", name: "Layer 2" }
        }
      ],
      source: { deckId: "deck-1", layerId: "layer-1" },
      layer: { id: "layer-1", name: "Layer 1" },
      transition: { type: "fade", durationMs: 500 }
    };

    const result = compositeProgramForOutput(program);

    expect(result?.compositionId).toBe("composition-1");
    expect(result?.layers.map((item) => item.layerId)).toEqual(["layer-1", "layer-2"]);
  });

  it("does not create an output when Program is empty", () => {
    const program: ProgramState = {
      compositionId: "composition-1",
      layers: [],
      source: null,
      layer: null,
      transition: null
    };

    expect(compositeProgramForOutput(program)).toBeNull();
  });
});
