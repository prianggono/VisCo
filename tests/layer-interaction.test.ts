import { describe, expect, it } from "vitest";
import type { Deck } from "../src/domain/deck.js";
import { DeckProgramController } from "../src/engine/deck-program-controller.js";
import { DeckRuntime } from "../src/engine/deck-runtime.js";
import { ProgramEngine } from "../src/engine/program-engine.js";
import { LayerInteraction } from "../src/ui/layer-interaction.js";

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

function createInteraction(): LayerInteraction {
  const runtime = new DeckRuntime();
  runtime.register(deck);

  return new LayerInteraction(
    new DeckProgramController(runtime, new ProgramEngine())
  );
}

describe("LayerInteraction", () => {
  it("clicking a layer name changes Preview only", () => {
    const interaction = createInteraction();

    interaction.click(deck, "layer-1", "box");
    interaction.click(deck, "layer-2", "name");

    const view = interaction.getViewState(deck);

    expect(view.previewLayerId).toBe("layer-2");
    expect(view.activeLayerId).toBe("layer-1");
    expect(view.layers.find((item) => item.layer.id === "layer-2")?.isPreview).toBe(true);
    expect(view.layers.find((item) => item.layer.id === "layer-1")?.isProgram).toBe(true);
  });

  it("clicking a layer box goes directly to Program", () => {
    const interaction = createInteraction();

    const result = interaction.click(deck, "layer-2", "box");

    expect("program" in result).toBe(true);
    if ("program" in result) {
      expect(result.program.source).toEqual({
        deckId: "deck-1",
        layerId: "layer-2"
      });
      expect(result.program.transition).toEqual({
        type: "fade",
        durationMs: 500
      });
    }

    const view = interaction.getViewState(deck);
    expect(view.previewLayerId).toBe("layer-2");
    expect(view.activeLayerId).toBe("layer-2");
  });


  it("uses runtime M state when entering Program", () => {
    const runtime = new DeckRuntime();
    runtime.register(deck);
    runtime.setMasterEnabled(deck.id, false);
    const controller = new DeckProgramController(runtime, new ProgramEngine());

    expect(() => controller.program(deck, "layer-1")).toThrow(
      'Deck "deck-1" is muted by M and cannot enter Program.'
    );
  });

  it("marks only the current Preview and Program layers", () => {
    const interaction = createInteraction();

    interaction.click(deck, "layer-1", "box");
    interaction.click(deck, "layer-3", "name");

    const view = interaction.getViewState(deck);

    expect(view.layers.map((item) => [item.layer.id, item.isPreview, item.isProgram])).toEqual([
      ["layer-1", false, true],
      ["layer-2", false, false],
      ["layer-3", true, false]
    ]);
  });
});
