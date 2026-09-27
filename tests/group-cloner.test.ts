import { describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "../src/persistence/project.js";
import { cloneGroupInProject } from "../src/engine/group-cloner.js";

const project: ProjectSnapshot = {
  version: 1,
  compositions: [],
  channels: [],
  decks: [
    {
      id: "deck-1",
      name: "Deck 1",
      layers: [
        { id: "layer-1", name: "A", sourceId: "source-1" },
        { id: "layer-2", name: "B", sourceId: "source-2" }
      ],
      transition: { type: "cut", durationMs: 0 }
    },
    {
      id: "deck-2",
      name: "Deck 2",
      layers: [
        { id: "layer-1", name: "A2", sourceId: "source-1" }
      ],
      transition: { type: "fade", durationMs: 500 }
    }
  ],
  groups: [
    {
      id: "group-1",
      name: "Main",
      deckId: "deck-1",
      layerIds: ["layer-1", "layer-2"],
      collapsed: false
    }
  ],
  slices: [],
  sources: [
    { id: "source-1", name: "A", kind: "video" },
    { id: "source-2", name: "B", kind: "video" }
  ],
  outputs: [],
  license: { state: "unlicensed", watermarkEnabled: true }
};

describe("Project Group cloning", () => {
  it("clones a Group in the same Deck by default", () => {
    const result = cloneGroupInProject(project, "group-1", {
      id: "group-copy",
      name: "Main Copy"
    });

    expect(result.group).toEqual({
      ...project.groups[0],
      id: "group-copy",
      name: "Main Copy"
    });
    expect(result.project.groups.map((group) => group.id)).toEqual(["group-1", "group-copy"]);
    expect(result.project.decks).toEqual(project.decks);
  });

  it("keeps the cloned Group in its owning Deck", () => {
    const result = cloneGroupInProject(project, "group-1", {
      id: "group-copy"
    });

    expect(result.group.deckId).toBe("deck-1");
    expect(result.group.layerIds).toEqual(["layer-1", "layer-2"]);
  });

  it("rejects a duplicate Group id", () => {
    expect(() =>
      cloneGroupInProject(project, "group-1", {
        id: "group-1"
      })
    ).toThrow('Group "group-1" already exists in the project.');
  });
});
