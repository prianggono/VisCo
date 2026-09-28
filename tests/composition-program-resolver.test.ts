import { describe, expect, it } from "vitest";
import type { Composition } from "../src/domain/composition.js";
import type { Slice } from "../src/domain/slice.js";
import type { ProgramState } from "../src/engine/program-engine.js";
import { resolveCompositionProgram } from "../src/engine/composition-program-resolver.js";

const composition: Composition = {
  id: "composition-1",
  name: "Main",
  format: { width: 1920, height: 1080, fps: 60, bitDepth: 8 },
  deckIds: ["deck-1"],
  sliceIds: ["slice-1", "slice-2"],
  locked: false
};

const slices: Slice[] = [
  {
    id: "slice-1",
    name: "Left",
    transform: { x: 0, y: 0, width: 960, height: 1080, rotation: 0 },
    layerRefs: [
      { deckId: "deck-1", layerId: "layer-1" },
      { deckId: "deck-1", layerId: "layer-2" }
    ],
    locked: false
  },
  {
    id: "slice-2",
    name: "Right",
    transform: { x: 960, y: 0, width: 960, height: 1080, rotation: 0 },
    layerRefs: [
      { deckId: "deck-1", layerId: "layer-3" }
    ],
    locked: false
  }
];

const program: ProgramState = {
  compositionId: "composition-1",
  layers: [
    {
      source: { deckId: "deck-1", layerId: "layer-2" },
      layer: { id: "layer-2", name: "Layer 2" }
    },
    {
      source: { deckId: "deck-1", layerId: "layer-3" },
      layer: { id: "layer-3", name: "Layer 3" }
    }
  ],
  source: { deckId: "deck-1", layerId: "layer-2" },
  layer: { id: "layer-2", name: "Layer 2" },
  transition: { type: "fade", durationMs: 500 }
};

describe("Composition Program resolver", () => {
  it("keeps Composition Slice order and resolves only active Program Layers", () => {
    const result = resolveCompositionProgram(composition, slices, program);

    expect(result.map((slice) => slice.sliceId)).toEqual(["slice-1", "slice-2"]);
    expect(result[0]?.layers.map(({ ref }) => ref)).toEqual([
      { deckId: "deck-1", layerId: "layer-2" }
    ]);
    expect(result[1]?.layers.map(({ ref }) => ref)).toEqual([
      { deckId: "deck-1", layerId: "layer-3" }
    ]);
    expect(result[0]?.transform).toEqual(slices[0]?.transform);
  });

  it("allows the same active Layer to appear in multiple mapped Slices", () => {
    const sharedSlices: Slice[] = [
      { ...slices[0], layerRefs: [{ deckId: "deck-1", layerId: "layer-2" }] },
      { ...slices[1], layerRefs: [{ deckId: "deck-1", layerId: "layer-2" }] }
    ];

    const result = resolveCompositionProgram(composition, sharedSlices, program);

    expect(result[0]?.layers).toHaveLength(1);
    expect(result[1]?.layers).toHaveLength(1);
    expect(result[0]?.layers[0]?.ref).toEqual(result[1]?.layers[0]?.ref);
  });

  it("resolves multiple active Layers in Slice order", () => {
    const multiSlice: Slice = {
      ...slices[0],
      layerRefs: [
        { deckId: "deck-1", layerId: "layer-2" },
        { deckId: "deck-1", layerId: "layer-3" }
      ]
    };

    const result = resolveCompositionProgram(composition, [multiSlice, slices[1]], program);

    expect(result[0]?.layers.map(({ ref }) => ref)).toEqual([
      { deckId: "deck-1", layerId: "layer-2" },
      { deckId: "deck-1", layerId: "layer-3" }
    ]);
  });

  it("rejects duplicate Program Layer references instead of silently collapsing them", () => {
    expect(() =>
      resolveCompositionProgram(
        composition,
        slices,
        {
          ...program,
          layers: [program.layers[0]!, program.layers[0]!]
        }
      )
    ).toThrow('Program contains duplicate Layer reference "deck-1/layer-2"');
  });

  it("rejects a Program Layer whose embedded ID disagrees with its reference", () => {
    expect(() =>
      resolveCompositionProgram(
        composition,
        slices,
        {
          ...program,
          layers: [{
            source: { deckId: "deck-1", layerId: "layer-2" },
            layer: { id: "layer-3", name: "Wrong Layer" }
          }]
        }
      )
    ).toThrow('does not match reference "deck-1/layer-2"');
  });

  it("rejects a Program Deck that is not attached to the Composition", () => {
    expect(() =>
      resolveCompositionProgram(
        composition,
        slices,
        {
          ...program,
          layers: [{
            source: { deckId: "deck-2", layerId: "layer-2" },
            layer: { id: "layer-2", name: "Layer 2" }
          }]
        }
      )
    ).toThrow('Program maps deck "deck-2", but that deck is not attached to Composition "composition-1"');
  });

  it("rejects a Program from another Composition", () => {
    expect(() =>
      resolveCompositionProgram(
        composition,
        slices,
        { ...program, compositionId: "composition-2" }
      )
    ).toThrow(/does not match Composition/);
  });

  it("rejects a missing Composition Slice", () => {
    expect(() =>
      resolveCompositionProgram(
        { ...composition, sliceIds: ["missing-slice"] },
        slices,
        program
      )
    ).toThrow('references missing Slice "missing-slice"');
  });

  it("rejects duplicate Layer references inside one Slice", () => {
    const duplicateSlice: Slice = {
      ...slices[0],
      layerRefs: [
        { deckId: "deck-1", layerId: "layer-2" },
        { deckId: "deck-1", layerId: "layer-2" }
      ]
    };

    expect(() =>
      resolveCompositionProgram(composition, [duplicateSlice, slices[1]], program)
    ).toThrow('contains duplicate Layer reference "deck-1/layer-2"');
  });
});
