import { describe, expect, it } from "vitest";
import { validateRelationships } from "../src/engine/relationship-validator.js";

const layer = { id: "layer-1", name: "Layer 1", sourceId: "src-1" };

describe("relationship validation", () => {
  it("accepts reusable sources and Deck-scoped layer references", () => {
    const result = validateRelationships({
      channels: [{ id: "offline", name: "Offline", type: "offline", deckIds: ["deck-1"], enabled: true }],
      compositions: [{
        id: "comp-1", name: "Venue", format: { width: 1920, height: 1080, fps: 29.97, bitDepth: 8 },
        deckIds: ["deck-1"], sliceIds: ["slice-1"], locked: false
      }],
      decks: [{ id: "deck-1", name: "Deck 1", groupIds: ["group-1"], layers: [layer], transition: { type: "fade", durationMs: 500 } }],
      groups: [{ id: "group-1", name: "Group 1", deckId: "deck-1", layerIds: ["layer-1"], collapsed: false }],
      sources: [{ id: "src-1", name: "Source 1", kind: "video" }],
      library: { sourceIds: ["src-1"] },
      slices: [{
        id: "slice-1", name: "Left",
        transform: { x: 0, y: 0, width: 960, height: 1080, rotation: 0 },
        layerRefs: [{ deckId: "deck-1", layerId: "layer-1" }],
        locked: false
      }]
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("reports broken cross-domain references", () => {
    const result = validateRelationships({
      compositions: [{
        id: "comp-1", name: "Venue", format: { width: 1920, height: 1080, fps: 29.97, bitDepth: 8 },
        deckIds: ["missing-deck"], sliceIds: ["missing-slice"], locked: false
      }],
      decks: [{ id: "deck-1", name: "Deck 1", groupIds: ["group-1"], layers: [layer], transition: { type: "cut", durationMs: 0 } }],
      groups: [{ id: "group-1", name: "Group 1", deckId: "deck-1", layerIds: ["missing-layer"], collapsed: false }],
      sources: [],
      slices: [{
        id: "slice-1", name: "Left",
        transform: { x: 0, y: 0, width: 960, height: 1080, rotation: 0 },
        layerRefs: [{ deckId: "deck-1", layerId: "missing-layer" }],
        locked: false
      }]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(5);
  });

  it("rejects a Slice mapping a Deck that is not attached to its Composition", () => {
    const result = validateRelationships({
      compositions: [{
        id: "comp-1",
        name: "Venue",
        format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 },
        deckIds: ["deck-1"],
        sliceIds: ["slice-1"],
        locked: false
      }],
      decks: [{
        id: "deck-1",
        name: "Deck 1",
        layers: [layer],
        transition: { type: "cut", durationMs: 0 }
      }, {
        id: "deck-2",
        name: "Deck 2",
        layers: [layer],
        transition: { type: "cut", durationMs: 0 }
      }],
      groups: [],
      slices: [{
        id: "slice-1",
        name: "Left",
        transform: { x: 0, y: 0, width: 960, height: 1080, rotation: 0 },
        layerRefs: [{ deckId: "deck-2", layerId: "layer-1" }],
        locked: false
      }],
      sources: [{ id: "src-1", name: "Source 1", kind: "video" }]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Slice "slice-1" maps deck "deck-2", but that deck is not attached to Composition "comp-1".'
    );
  });

  it("allows the same local Layer ID in multiple Decks", () => {
    const result = validateRelationships({
      compositions: [],
      decks: [
        { id: "deck-1", name: "Deck 1", layers: [layer], transition: { type: "cut", durationMs: 0 } },
        { id: "deck-2", name: "Deck 2", layers: [layer], transition: { type: "cut", durationMs: 0 } }
      ],
      groups: [],
      slices: [],
      sources: [{ id: "src-1", name: "Source 1", kind: "video" }]
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects duplicate entity IDs and duplicate Layer IDs within a Deck", () => {
    const result = validateRelationships({
      compositions: [],
      decks: [{
        id: "deck-1",
        name: "Deck 1",
        layers: [layer, { ...layer, name: "Layer 1 duplicate" }],
        transition: { type: "cut", durationMs: 0 }
      }],
      groups: [],
      slices: [],
      sources: [{ id: "src-1", name: "Source 1", kind: "video" }]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Deck "deck-1" contains duplicate Layer ID "layer-1".');
  });

  it("rejects a Group owned by one Deck but referenced by another", () => {
    const result = validateRelationships({
      compositions: [],
      decks: [
        { id: "deck-1", name: "Deck 1", groupIds: ["group-1"], layers: [layer], transition: { type: "cut", durationMs: 0 } },
        { id: "deck-2", name: "Deck 2", layers: [layer], transition: { type: "cut", durationMs: 0 } }
      ],
      groups: [{ id: "group-1", name: "Group 1", deckId: "deck-2", layerIds: ["layer-1"], collapsed: false }],
      slices: [],
      sources: [{ id: "src-1", name: "Source 1", kind: "video" }]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Group "group-1" belongs to deck "deck-2" but is referenced by deck "deck-1".');
  });

  it("rejects a Library index that diverges from canonical Sources", () => {
    const result = validateRelationships({
      compositions: [],
      decks: [],
      groups: [],
      slices: [],
      sources: [{ id: "src-1", name: "Source 1", kind: "video" }],
      library: { sourceIds: ["src-2"] }
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Library references missing Source "src-2".');
    expect(result.errors).toContain('Source "src-1" is missing from Library index.');
  });

  it("rejects duplicate Source IDs inside the Library index", () => {
    const result = validateRelationships({
      compositions: [],
      decks: [],
      groups: [],
      slices: [],
      sources: [{ id: "src-1", name: "Source 1", kind: "video" }],
      library: { sourceIds: ["src-1", "src-1"] }
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Library contains duplicate Source ID "src-1".');
  });

});