import { describe, expect, it } from "vitest";
import { createProjectSnapshot, parseProject, serializeProject } from "../src/engine/project-persistence.js";

describe("project runtime persistence", () => {
  it("round-trips active scenes, programs, preview and active layers", () => {
    const snapshot = createProjectSnapshot({
      compositions: [],
      decks: [],
      groups: [],
      layers: [],
      slices: [],
      scenes: [],
      sources: [],
      outputs: [],
      activeSceneIds: { default: "scene-display-2" },
      programs: { default: { deckId: "deck-1", layerId: "layer-2" } },
      deckPreviewLayerIds: { "deck-1": "layer-2" },
      deckActiveLayerIds: { "deck-1": "layer-2" }
    });
    const parsed = parseProject(serializeProject(snapshot));
    expect(parsed.activeSceneIds?.default).toBe("scene-display-2");
    expect(parsed.programs?.default).toEqual({ deckId: "deck-1", layerId: "layer-2" });
    expect(parsed.deckPreviewLayerIds?.["deck-1"]).toBe("layer-2");
    expect(parsed.deckActiveLayerIds?.["deck-1"]).toBe("layer-2");
  });
});
