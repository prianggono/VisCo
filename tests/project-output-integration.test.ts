import { describe, expect, it } from "vitest";
import { ProjectRuntime, projectSnapshotFromCollections } from "../src/engine/project-runtime.js";
import { compositeProgramForOutput } from "../src/engine/output-compositor.js";
import { createOutputFrame } from "../src/engine/output-frame-builder.js";
import { OutputEngine } from "../src/engine/output-engine.js";
import { toD3D11RenderFrame } from "../src/engine/d3d11-output-adapter.js";
import type { Deck } from "../src/domain/deck.js";
import type { Scene } from "../src/domain/scene.js";

const layer = { id: "layer-1", name: "Layer 1", order: 0 };
const deck: Deck = {
  id: "deck-1",
  name: "Deck 1",
  layers: [layer],
  compositionId: "comp-1",
  transition: { type: "fade", durationMs: 500 }
};
const scene: Scene = {
  id: "scene-1",
  name: "Display 1",
  compositionId: "comp-1",
  target: { kind: "display", displayId: "display-1" },
  enabled: true
};

describe("project/output integration", () => {
  it("round-trips a validated project snapshot and tracks dirty state", () => {
    const runtime = new ProjectRuntime(projectSnapshotFromCollections({
      compositions: [{
        id: "comp-1", name: "Main", format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 },
        deckIds: ["deck-1"], groupIds: [], sliceIds: [], locked: false
      }],
      decks: [deck], groups: [], slices: [], scenes: [scene], sources: [], outputs: []
    }));
    expect(runtime.getState().dirty).toBe(false);
    runtime.markDirty();
    expect(runtime.getState().dirty).toBe(true);
    const serialized = runtime.serialize();
    const loaded = runtime.load(serialized);
    expect(loaded.dirty).toBe(false);
    expect(loaded.decks[0].id).toBe("deck-1");
  });

  it("rejects broken scene/composition relationships", () => {
    expect(() => new ProjectRuntime(projectSnapshotFromCollections({
      compositions: [],
      decks: [deck], groups: [], slices: [],
      scenes: [{ ...scene, compositionId: "missing" }],
      sources: [], outputs: []
    }))).toThrow(/missing composition/);
  });

  it("selects the active program layer for output composition", () => {
    const program = {
      compositionId: "comp-1",
      source: { deckId: "deck-1", layerId: "layer-1" },
      layer,
      layers: [layer],
      transition: deck.transition
    };
    const result = compositeProgramForOutput(program);
    expect(result?.layer.layerId).toBe("layer-1");
  });

  it("routes Display and Production Scenes to their canonical outputs", () => {
    const output = new OutputEngine();
    output.register({ id: "display-1", kind: "display", enabled: true, compositionId: "comp-1" });
    output.register({ id: "display-2", kind: "display", enabled: true, compositionId: "comp-1" });
    output.register({ id: "production", kind: "media", enabled: true, media: {
      compositionId: "comp-1", resolution: [1920, 1080], fps: 30, streaming: true, recording: true, virtual: true
    } });
    const source = { deckId: "deck-1", layerId: "layer-1" };
    expect(output.syncFromScene(scene, source).map((state) => state.target.id)).toEqual(["display-1"]);
    const production = { ...scene, id: "production-scene", name: "Production", target: { kind: "production" as const, record: true, stream: true, virtual: true } };
    expect(output.syncFromScene(production, source).map((state) => state.target.id)).toEqual(["production"]);
  });

  it("builds an output frame using the active scene and slice references", () => {
    const program = {
      compositionId: "comp-1",
      source: { deckId: "deck-1", layerId: "layer-1" },
      layer,
      layers: [layer],
      transition: deck.transition
    };
    const frame = createOutputFrame(program, scene, { width: 1920, height: 1080, fps: 30 }, 7, [{
      id: "slice-1", name: "Slice 1",
      transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
      layerIds: ["layer-1"], locked: false
    }]);
    expect(frame.sceneId).toBe("scene-1");
    expect(frame.layerIds).toEqual(["layer-1"]);
    expect(frame.slices?.[0]?.id).toBe("slice-1");
    expect(frame.slices?.[0]?.transform.width).toBe(1920);
    const renderFrame = toD3D11RenderFrame(frame);
    expect(renderFrame.slices?.[0]?.id).toBe("slice-1");
  });
});
