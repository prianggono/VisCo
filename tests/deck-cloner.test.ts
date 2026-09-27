import { describe, expect, it } from "vitest";
import type { Deck } from "../src/domain/deck.js";
import type { Group } from "../src/domain/group.js";
import { cloneDeck, cloneGroup } from "../src/engine/deck-cloner.js";

const sourceDeck: Deck = {
  id: "deck-live",
  name: "Deck Live",
  layers: [
    {
      id: "layer-1",
      name: "Opening",
      sourceId: "source-video",
      transform: { x: 12, y: -8, scaleX: 98, scaleY: 98, scaleLinked: true, rotation: 0, opacity: 100 },
      playback: { playing: true, loop: true, speed: 100 },
      blendMode: "Normal",
      order: 1
    },
    {
      id: "layer-2",
      name: "Logo",
      sourceId: "source-logo",
      transform: { x: 0, y: 0, scaleX: 100, scaleY: 100, scaleLinked: true, rotation: 0, opacity: 100 },
      playback: { playing: false, loop: false, speed: 100 },
      order: 2
    }
  ],
  groupIds: ["group-live"],
  masterLevel: 100,
  audioLevel: 80,
  visualLevel: 100,
  loop: true,
  transition: { type: "fade", durationMs: 500 }
};

const sourceGroup: Group = {
  id: "group-live",
  name: "Live Layout",
  deckId: "deck-live",
  layerIds: ["layer-1", "layer-2"],
  collapsed: false
};

const ids = {
  nextDeckId: () => "deck-clone",
  nextGroupId: () => "group-clone"
};

describe("Deck and Group cloning", () => {
  it("clones a Group with a new identity in the same Deck", () => {
    const clone = cloneGroup(sourceGroup, { id: "group-copy", name: "Live Layout Copy" });

    expect(clone).toEqual({
      ...sourceGroup,
      id: "group-copy",
      name: "Live Layout Copy",
      layerIds: ["layer-1", "layer-2"]
    });
    expect(clone).not.toBe(sourceGroup);
  });

  it("clones Deck configuration without cloning Source or Slice mappings", () => {
    const result = cloneDeck(sourceDeck, [sourceGroup], {
      id: "deck-clone",
      name: "Deck Live Copy",
      idFactory: ids
    });

    expect(result.deck.id).toBe("deck-clone");
    expect(result.deck.name).toBe("Deck Live Copy");
    expect(result.deck.transition).toEqual(sourceDeck.transition);
    expect(result.deck.layers[0].sourceId).toBe("source-video");
    expect(result.deck.layers[0].transform).toEqual(sourceDeck.layers[0].transform);
    expect(result.deck.layers[0].playback).toEqual(sourceDeck.layers[0].playback);
    expect(result.deck.groupIds).toEqual(["group-clone"]);
    expect(result.groups[0]).toEqual({
      ...sourceGroup,
      id: "group-clone",
      deckId: "deck-clone",
      layerIds: ["layer-1", "layer-2"]
    });
    expect(result.deck).not.toBe(sourceDeck);
    expect(result.deck.layers[0]).not.toBe(sourceDeck.layers[0]);
    expect(result.deck.layers[0].sourceId).toBe(sourceDeck.layers[0].sourceId);
  });

  it("does not clone unrelated Groups", () => {
    const unrelated: Group = { ...sourceGroup, id: "other", deckId: "other-deck" };
    const result = cloneDeck(sourceDeck, [sourceGroup, unrelated], {
      id: "deck-clone",
      idFactory: ids
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].id).toBe("group-clone");
  });
});
