import { describe, expect, it } from "vitest";
import { OutputPipeline } from "../src/engine/output-pipeline.js";

const composition = {
  id: "comp-1",
  name: "Main",
  format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 as const },
  deckIds: ["deck-1"],
  groupIds: [],
  sliceIds: ["slice-1"],
  locked: false
};

const layer = { id: "layer-1", name: "Layer 1", order: 0 };
const program = {
  compositionId: "comp-1",
  source: { deckId: "deck-1", layerId: "layer-1" },
  layer,
  layers: [layer],
  transition: { type: "fade" as const, durationMs: 500 }
};
const scene = {
  id: "scene-1",
  name: "Display 1",
  compositionId: "comp-1",
  target: { kind: "display" as const, displayId: "display-1" },
  enabled: true
};
const slices = [{
  id: "slice-1",
  name: "Screen A",
  transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
  layerRefs: [{ deckId: "deck-1", layerId: "layer-1" }],
  locked: false
}];

describe("output pipeline", () => {
  it("builds the Program -> Scene -> OutputFrame -> D3D11 boundary", () => {
    const pipeline = new OutputPipeline();
    const frame = pipeline.nextFrame(program, scene, composition, slices);
    expect(frame.source.frameNumber).toBe(0);
    expect(frame.sceneId).toBe("scene-1");
    expect(frame.layerIds).toEqual(["layer-1"]);
    expect(pipeline.nextD3D11Frame(program, scene, composition, slices).width).toBe(1920);
    expect(pipeline.getFrameNumber()).toBe(2);
  });

  it("keeps frame numbering deterministic and resettable", () => {
    const pipeline = new OutputPipeline();
    pipeline.nextFrame(program, scene, composition, slices);
    pipeline.nextFrame(program, scene, composition, slices);
    expect(pipeline.getFrameNumber()).toBe(2);
    pipeline.resetFrameNumber();
    expect(pipeline.getFrameNumber()).toBe(0);
  });
});


describe("output pipeline layer state", () => {
  it("does not emit invisible layers", () => {
    const hidden = { ...layer, visible: false };
    const p = { ...program, layer: hidden, layers: [hidden] };
    const frame = new OutputPipeline().nextFrame(p, scene, composition, slices);
    expect(frame.layerIds).toEqual([]);
    expect(frame.layers).toEqual([]);
  });

  it("emits only solo layers when solo mode is active", () => {
    const first = { ...layer, id: "layer-1", solo: false };
    const second = { ...layer, id: "layer-2", order: 1, solo: true };
    const p = { ...program, source: { deckId: "deck-1", layerId: "layer-2" }, layer: second, layers: [first, second] };
    const scopedSlices = [{ ...slices[0], layerRefs: [
      { deckId: "deck-1", layerId: "layer-1" },
      { deckId: "deck-1", layerId: "layer-2" }
    ] }];
    const frame = new OutputPipeline().nextFrame(p, scene, composition, scopedSlices);
    expect(frame.layerIds).toEqual(["layer-2"]);
  });
});
