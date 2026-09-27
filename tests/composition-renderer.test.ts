import { describe, expect, it } from "vitest";
import type { Composition } from "../src/domain/composition.js";
import type { Slice } from "../src/domain/slice.js";
import type { ProgramState } from "../src/engine/program-engine.js";
import { renderCompositionProgram } from "../src/engine/composition-renderer.js";

const composition: Composition = {
  id: "composition-1",
  name: "Main",
  format: { width: 1920, height: 1080, fps: 60, bitDepth: 8 },
  deckIds: ["deck-1"],
  sliceIds: ["slice-1"],
  locked: false
};

const slice: Slice = {
  id: "slice-1",
  name: "Left",
  transform: { x: 100, y: 200, width: 960, height: 540, rotation: 5 },
  layerRefs: [{ deckId: "deck-1", layerId: "layer-2" }],
  locked: false
};

const program: ProgramState = {
  compositionId: "composition-1",
  layers: [{
    source: { deckId: "deck-1", layerId: "layer-2" },
    layer: {
      id: "layer-2",
      name: "Layer 2",
      transform: {
        x: 30,
        y: 40,
        scaleX: 120,
        scaleY: 80,
        scaleLinked: false,
        rotation: 10,
        opacity: 75
      },
      order: 3,
      blendMode: "screen"
    }
  }],
  source: { deckId: "deck-1", layerId: "layer-2" },
  layer: {
    id: "layer-2",
    name: "Layer 2"
  },
  transition: { type: "fade", durationMs: 500 }
};

describe("Composition renderer", () => {
  it("combines Layer and Slice render values without moving ownership", () => {
    const result = renderCompositionProgram(composition, [slice], program);

    expect(result).toHaveLength(1);
    expect(result[0]?.layerId).toBe("layer-2");
    expect(result[0]?.sliceId).toBe("slice-1");
    expect(result[0]?.sliceStyle).toEqual({
      x: 100,
      y: 200,
      width: 960,
      height: 540,
      rotation: 5
    });
    expect(result[0]?.layerStyle.transform).toContain("translate(30px, 40px)");
    expect(result[0]?.layerStyle.opacity).toBe(75);
    expect(result[0]?.layerStyle.zIndex).toBe(3);
    expect(result[0]?.layerStyle.mixBlendMode).toBe("screen");
  });

  it("renders only Layers active in Program", () => {
    const inactiveSlice: Slice = {
      ...slice,
      layerRefs: [
        { deckId: "deck-1", layerId: "layer-1" },
        { deckId: "deck-1", layerId: "layer-2" }
      ]
    };

    const result = renderCompositionProgram(composition, [inactiveSlice], program);

    expect(result.map(({ layerId }) => layerId)).toEqual(["layer-2"]);
  });
});
