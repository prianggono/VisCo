import { describe, expect, it } from "vitest";
import type { Deck } from "../src/domain/deck.js";
import type { Group } from "../src/domain/group.js";
import { resolveGroupLayers } from "../src/engine/group-resolver.js";

const deck: Deck = {
  id: "deck-1",
  name: "Deck 1",
  layers: [
    { id: "layer-kiri", name: "Camera Kiri", sourceId: "camera-1" },
    { id: "layer-ppt", name: "PPT", sourceId: "ppt-1" },
    { id: "layer-kanan", name: "Camera Kanan", sourceId: "camera-2" }
  ],
  transition: { type: "fade", durationMs: 300 }
};

describe("group resolver", () => {
  it("preserves Group layerIds order as formasi order", () => {
    const group: Group = {
      id: "group-1",
      name: "Kamera",
      deckId: "deck-1",
      layerIds: ["layer-kiri", "layer-ppt", "layer-kanan"],
      collapsed: false
    };

    const resolved = resolveGroupLayers(deck, group);

    expect(resolved.map((item) => item.ref)).toEqual([
      { deckId: "deck-1", layerId: "layer-kiri" },
      { deckId: "deck-1", layerId: "layer-ppt" },
      { deckId: "deck-1", layerId: "layer-kanan" }
    ]);
  });

  it("allows the same Layer to be referenced by different Groups", () => {
    const group1: Group = {
      id: "group-1",
      name: "Kamera",
      deckId: "deck-1",
      layerIds: ["layer-kiri", "layer-ppt", "layer-kanan"],
      collapsed: false
    };
    const group2: Group = {
      id: "group-2",
      name: "Sponsor",
      deckId: "deck-1",
      layerIds: ["layer-kiri", "layer-ppt"],
      collapsed: false
    };

    expect(resolveGroupLayers(deck, group1).map((item) => item.layer.id)).toEqual([
      "layer-kiri", "layer-ppt", "layer-kanan"
    ]);
    expect(resolveGroupLayers(deck, group2).map((item) => item.layer.id)).toEqual([
      "layer-kiri", "layer-ppt"
    ]);
  });

  it("rejects a Group owned by another Deck", () => {
    const group: Group = {
      id: "group-1",
      name: "Wrong Deck",
      deckId: "deck-2",
      layerIds: ["layer-kiri"],
      collapsed: false
    };

    expect(() => resolveGroupLayers(deck, group)).toThrow(/belongs to deck/);
  });

  it("rejects duplicate Layer references inside one Group", () => {
    const group: Group = {
      id: "group-1",
      name: "Invalid",
      deckId: "deck-1",
      layerIds: ["layer-kiri", "layer-kiri"],
      collapsed: false
    };

    expect(() => resolveGroupLayers(deck, group)).toThrow(/duplicate layer/);
  });
});
