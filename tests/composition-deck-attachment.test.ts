import { describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "../src/persistence/project.js";
import { attachDeckToComposition } from "../src/engine/composition-deck-attachment.js";

const project: ProjectSnapshot = {
  version: 1,
  compositions: [
    {
      id: "composition-live",
      name: "Live",
      format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 },
      deckIds: ["deck-a"],
      sliceIds: ["slice-live"],
      locked: false
    },
    {
      id: "composition-other",
      name: "Other",
      format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 },
      deckIds: [],
      sliceIds: [],
      locked: false
    }
  ],
  channels: [
    {
      id: "channel-offline",
      name: "Offline",
      type: "offline",
      deckIds: ["deck-a"],
      enabled: true
    }
  ],
  decks: [
    {
      id: "deck-a",
      name: "A",
      layers: [],
      transition: { type: "cut", durationMs: 0 }
    },
    {
      id: "deck-b",
      name: "B",
      layers: [],
      transition: { type: "fade", durationMs: 500 }
    }
  ],
  groups: [],
  slices: [
    {
      id: "slice-live",
      name: "Main",
      transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
      layerRefs: [],
      locked: false
    }
  ],
  sources: [],
  outputs: [
    {
      id: "output-live",
      kind: "display",
      enabled: true,
      compositionId: "composition-live",
      deckId: "deck-a"
    }
  ],
  license: { state: "unlicensed", watermarkEnabled: true }
};

describe("Attach Deck to Composition", () => {
  it("appends a Deck by default without changing other presentation configuration", () => {
    const result = attachDeckToComposition(project, {
      compositionId: "composition-live",
      deckId: "deck-b"
    });

    expect(result.composition.deckIds).toEqual(["deck-a", "deck-b"]);
    expect(result.project.compositions[1].deckIds).toEqual([]);
    expect(result.project.channels).toEqual(project.channels);
    expect(result.project.outputs).toEqual(project.outputs);
    expect(result.project.slices).toEqual(project.slices);
    expect(project.compositions[0].deckIds).toEqual(["deck-a"]);
  });

  it("supports an explicit insertion index", () => {
    const result = attachDeckToComposition(project, {
      compositionId: "composition-live",
      deckId: "deck-b",
      index: 0
    });

    expect(result.composition.deckIds).toEqual(["deck-b", "deck-a"]);
  });

  it("rejects a duplicate Deck attachment", () => {
    expect(() =>
      attachDeckToComposition(project, {
        compositionId: "composition-live",
        deckId: "deck-a"
      })
    ).toThrow(
      'Deck "deck-a" is already attached to Composition "composition-live".'
    );
  });

  it("rejects a missing Composition", () => {
    expect(() =>
      attachDeckToComposition(project, {
        compositionId: "missing-composition",
        deckId: "deck-b"
      })
    ).toThrow(
      'Composition "missing-composition" does not exist in the project.'
    );
  });

  it("rejects a missing Deck", () => {
    expect(() =>
      attachDeckToComposition(project, {
        compositionId: "composition-live",
        deckId: "missing-deck"
      })
    ).toThrow('Deck "missing-deck" does not exist in the project.');
  });

  it("rejects an invalid insertion index", () => {
    expect(() =>
      attachDeckToComposition(project, {
        compositionId: "composition-live",
        deckId: "deck-b",
        index: 99
      })
    ).toThrow(
      'Deck attachment index 99 is out of range for Composition "composition-live".'
    );
  });
});
