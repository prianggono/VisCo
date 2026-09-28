import { describe, expect, it } from "vitest";
import { assertSourceRemovable, findSourceUsage, isLayerProgrammed } from "../src/engine/source-usage.js";

const decks = [{
  id: "deck-1",
  name: "Deck 1",
  layers: [
    { id: "layer-1", name: "Layer 1", sourceId: "src-1" },
    { id: "layer-2", name: "Layer 2", sourceId: "src-2" }
  ],
  groupIds: ["group-1"],
  transition: { type: "cut" as const, durationMs: 0 }
}];

const groups = [{
  id: "group-1",
  name: "Opening Group",
  deckId: "deck-1",
  layerIds: ["layer-1"],
  collapsed: false
}];

const programs = [{
  compositionId: "offline",
  layers: [{
    source: { deckId: "deck-1", layerId: "layer-1" },
    layer: { id: "layer-1", name: "Layer 1", sourceId: "src-1" }
  }],
  source: { deckId: "deck-1", layerId: "layer-1" },
  layer: { id: "layer-1", name: "Layer 1", sourceId: "src-1" },
  transition: null
}];

describe("Source usage resolver", () => {
  it("reports Deck/Layer and Group usage", () => {
    expect(findSourceUsage("src-1", { decks, groups }).layers).toEqual([{
      deckId: "deck-1",
      deckName: "Deck 1",
      layerId: "layer-1",
      layerName: "Layer 1",
      groupIds: ["group-1"],
      groupNames: ["Opening Group"]
    }]);
  });

  it("reports committed Program usage separately from canonical usage", () => {
    expect(findSourceUsage("src-1", { decks, groups, programs }).program).toEqual([{
      compositionId: "offline",
      deckId: "deck-1",
      layerId: "layer-1",
      layerName: "Layer 1"
    }]);
  });

  it("detects whether a specific Layer is currently Programmed", () => {
    expect(isLayerProgrammed(
      { deckId: "deck-1", layerId: "layer-1" },
      programs
    )).toBe(true);

    expect(isLayerProgrammed(
      { deckId: "deck-1", layerId: "layer-2" },
      programs
    )).toBe(false);
  });

  it("allows the same Source to be reused by multiple Layers", () => {
    const result = findSourceUsage("src-2", {
      decks: [{
        ...decks[0],
        layers: [
          ...decks[0].layers,
          { id: "layer-3", name: "Layer 3", sourceId: "src-2" }
        ]
      }],
      groups
    });

    expect(result.layers.map((item) => item.layerId)).toEqual(["layer-2", "layer-3"]);
  });
  it("blocks removal and reports Deck/Layer/Group references", () => {
    expect(() => assertSourceRemovable("src-1", { decks, groups })).toThrow(
      'Source "src-1" is still in use: Deck "Deck 1" / Layer "Layer 1" · Group: Opening Group.'
    );
  });

  it("blocks removal and reports committed Program references", () => {
    expect(() => assertSourceRemovable("src-1", { decks: [], groups: [], programs })).toThrow(
      'PROGRAM "offline" / Deck "deck-1" / Layer "Layer 1"'
    );
  });

  it("allows removal when no Layer or Program references remain", () => {
    expect(() => assertSourceRemovable("unused", { decks: [], groups: [], programs })).not.toThrow();
  });

});
