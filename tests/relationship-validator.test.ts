import { describe, expect, it } from "vitest";
import { validateRelationships } from "../src/engine/relationship-validator.js";

const layer = { id: "layer-1", name: "Layer 1", sourceId: "src-1", sliceIds: ["slice-1"] };

describe("relationship validation", () => {
  it("accepts reusable sources and many-to-many layer/slice references", () => {
    const result = validateRelationships({
      compositions: [{
        id: "comp-1", name: "Venue", format: { width: 1920, height: 1080, fps: 29.97, bitDepth: 8 },
        deckIds: ["deck-1"], groupIds: ["group-1"], sliceIds: ["slice-1"], locked: false
      }],
      decks: [{ id: "deck-1", name: "Deck 1", layers: [layer], compositionId: "comp-1", transition: { type: "fade", durationMs: 500 } }],
      groups: [{ id: "group-1", name: "Group 1", layerIds: ["layer-1"], collapsed: false }],
      layers: [layer],
      sources: [{ id: "src-1", name: "Source 1", kind: "video" }],
      slices: [{ id: "slice-1", name: "Left", transform: { x: 0, y: 0, width: 960, height: 1080, rotation: 0 }, layerIds: ["layer-1"], locked: false }]
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("reports broken cross-domain references", () => {
    const result = validateRelationships({
      compositions: [{
        id: "comp-1", name: "Venue", format: { width: 1920, height: 1080, fps: 29.97, bitDepth: 8 },
        deckIds: ["missing-deck"], groupIds: ["missing-group"], sliceIds: ["missing-slice"], locked: false
      }],
      decks: [{ id: "deck-1", name: "Deck 1", layers: [layer], compositionId: "missing-comp", transition: { type: "cut", durationMs: 0 } }],
      groups: [{ id: "group-1", name: "Group 1", layerIds: ["missing-layer"], collapsed: false }],
      layers: [layer],
      sources: [],
      slices: [{ id: "slice-1", name: "Left", transform: { x: 0, y: 0, width: 960, height: 1080, rotation: 0 }, layerIds: ["missing-layer"], locked: false }]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(7);
  });
});
