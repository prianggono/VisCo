import { describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "../src/persistence/project.js";
import { cloneDeckInProject } from "../src/engine/project-cloner.js";

const project: ProjectSnapshot = {
  version: 1,
  compositions: [
    {
      id: "composition-live",
      name: "Live",
      format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 },
      deckIds: ["deck-live"],
      sliceIds: ["slice-live"],
      locked: false
    }
  ],
  channels: [
    {
      id: "channel-offline",
      name: "Offline",
      type: "offline",
      deckIds: ["deck-live"],
      enabled: true
    }
  ],
  decks: [
    {
      id: "deck-live",
      name: "Live",
      layers: [
        {
          id: "layer-1",
          name: "Opening",
          sourceId: "source-video",
          sliceIds: ["slice-live"],
          transform: { x: 10, y: 20, scaleX: 100, scaleY: 100, rotation: 0, opacity: 100 },
          playback: { playing: true, loop: true, speed: 100 }
        }
      ],
      groupIds: ["group-live"],
      transition: { type: "fade", durationMs: 500 }
    }
  ],
  groups: [
    {
      id: "group-live",
      name: "Live Group",
      deckId: "deck-live",
      layerIds: ["layer-1"],
      collapsed: false
    }
  ],
  slices: [
    {
      id: "slice-live",
      name: "LED Main",
      transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
      layerRefs: [{ deckId: "deck-live", layerId: "layer-1" }],
      locked: false
    }
  ],
  sources: [
    { id: "source-video", name: "Opening.mp4", kind: "video" }
  ],
  outputs: [
    { id: "led-main", kind: "display", enabled: true, compositionId: "composition-live", deckId: "deck-live" }
  ],
  license: { tier: "free", status: "active" }
};

const ids = {
  nextDeckId: () => "deck-clone",
  nextGroupId: () => "group-clone"
};

describe("Project Deck cloning", () => {
  it("adds the clone without changing presentation/runtime ownership", () => {
    const result = cloneDeckInProject(project, "deck-live", {
      id: "deck-clone",
      name: "Live Copy",
      idFactory: ids
    });

    expect(result.project.decks.map((deck) => deck.id)).toEqual(["deck-live", "deck-clone"]);
    expect(result.project.groups.map((group) => group.id)).toEqual(["group-live", "group-clone"]);

    expect(result.project.compositions[0].deckIds).toEqual(["deck-live"]);
    expect(result.project.channels[0].deckIds).toEqual(["deck-live"]);
    expect(result.project.outputs[0].deckId).toBe("deck-live");

    expect(result.deck.layers[0].sourceId).toBe("source-video");
    expect(result.deck.layers[0].sliceIds).toBeUndefined();
    expect(result.groups[0].deckId).toBe("deck-clone");

    expect(project.decks).toHaveLength(1);
    expect(project.groups).toHaveLength(1);
  });

  it("rejects a missing source Deck", () => {
    expect(() =>
      cloneDeckInProject(project, "missing-deck", {
        id: "deck-clone",
        idFactory: ids
      })
    ).toThrow('Deck "missing-deck" does not exist in the project.');
  });

  it("rejects a duplicate Deck id before mutating the project", () => {
    expect(() =>
      cloneDeckInProject(project, "deck-live", {
        id: "deck-live",
        idFactory: ids
      })
    ).toThrow('Deck "deck-live" already exists in the project.');
  });
});
