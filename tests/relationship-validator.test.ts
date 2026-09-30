import { describe, expect, it } from "vitest";
import { validateRelationships } from "../src/engine/relationship-validator.js";

const layer = { id: "layer-1", name: "Layer 1", sourceId: "src-1" };

describe("relationship validation", () => {
  it("accepts reusable sources and many-to-many layer/slice references", () => {
    const result = validateRelationships({
      compositions: [{
        id: "comp-1", name: "Venue", format: { width: 1920, height: 1080, fps: 29.97, bitDepth: 8 },
        deckIds: ["deck-1"], groupIds: ["group-1"], sliceIds: ["slice-1"], locked: false
      }],
      decks: [{ id: "deck-1", name: "Deck 1", layers: [layer], transition: { type: "fade", durationMs: 500 } }],
      groups: [{ id: "group-1", name: "Group 1", layerIds: ["layer-1"], collapsed: false }],
      layers: [layer],
      sources: [{ id: "src-1", name: "Source 1", kind: "video" }],
      slices: [{ id: "slice-1", name: "Left", transform: { x: 0, y: 0, width: 960, height: 1080, rotation: 0 }, layerRefs: [{ deckId: "deck-1", layerId: "layer-1" }], locked: false }]
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("reports broken cross-domain references", () => {
    const result = validateRelationships({
      compositions: [{
        id: "comp-1", name: "Venue", format: { width: 1920, height: 1080, fps: 29.97, bitDepth: 8 },
        deckIds: ["missing-deck"], groupIds: ["missing-group"], sliceIds: ["missing-slice"], locked: false
      }],
      decks: [{ id: "deck-1", name: "Deck 1", layers: [layer], transition: { type: "cut", durationMs: 0 } }],
      groups: [{ id: "group-1", name: "Group 1", layerIds: ["missing-layer"], collapsed: false }],
      layers: [layer],
      sources: [],
      slices: [{ id: "slice-1", name: "Left", transform: { x: 0, y: 0, width: 960, height: 1080, rotation: 0 }, layerRefs: [{ deckId: "deck-1", layerId: "missing-layer" }], locked: false }]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(10);
  });
});


it("rejects duplicate IDs across the same collection", () => {
  const result = validateRelationships({
    compositions: [],
    decks: [],
    groups: [],
    layers: [{ id: "layer-1", name: "A" }, { id: "layer-1", name: "B" }],
    slices: []
  });
  expect(result.valid).toBe(false);
  expect(result.errors.some((error) => error.includes('Duplicate layer id "layer-1"'))).toBe(true);
});


it("rejects orphan and multiply-owned composition objects", () => {
  const sharedDeck = { id: "deck-shared", name: "Shared", layers: [{ id: "layer-shared", name: "Layer" }], transition: { type: "cut" as const, durationMs: 0 } };
  const orphanGroup = { id: "group-orphan", name: "Orphan", layerIds: ["layer-shared"], collapsed: false };
  const orphanSlice = { id: "slice-orphan", name: "Orphan", transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0 }, layerRefs: [{ deckId: "deck-shared", layerId: "layer-shared" }], locked: false };
  const result = validateRelationships({
    compositions: [
      { id: "comp-a", name: "A", format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 }, deckIds: ["deck-shared"], groupIds: [], sliceIds: [], locked: false },
      { id: "comp-b", name: "B", format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 }, deckIds: ["deck-shared"], groupIds: [], sliceIds: [], locked: false }
    ],
    decks: [sharedDeck],
    groups: [orphanGroup],
    layers: sharedDeck.layers,
    slices: [orphanSlice]
  });

  expect(result.valid).toBe(false);
  expect(result.errors.some((error) => error.includes('deck "deck-shared" belongs to multiple Compositions'))).toBe(true);
  expect(result.errors.some((error) => error.includes('group "group-orphan" is not owned'))).toBe(true);
  expect(result.errors.some((error) => error.includes('slice "slice-orphan" is not owned'))).toBe(true);
});
