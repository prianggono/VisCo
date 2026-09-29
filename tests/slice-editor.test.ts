import { describe, expect, it } from "vitest";
import { patchSliceMapping } from "../src/engine/slice-editor.js";
import type { Slice } from "../src/domain/slice.js";

const slice: Slice = {
  id: "slice-1",
  name: "Screen",
  transform: { x: 10, y: 20, width: 100, height: 50, rotation: 0 },
  mapping: { mode: "rectangle" },
  layerRefs: [{ deckId: "deck-1", layerId: "layer-1" }],
  locked: false
};

describe("Slice editor mapping", () => {
  it("creates four default corners when switching a new Slice to Corner Pin", () => {
    const updated = patchSliceMapping(slice, { mode: "corner-pin" });
    expect(updated.mapping?.points).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 70 },
      { x: 10, y: 70 }
    ]);
  });

  it("preserves canonical Layer references while editing mapping", () => {
    const updated = patchSliceMapping(slice, { mode: "polygon" });
    expect(updated.layerRefs).toEqual(slice.layerRefs);
    expect(updated.mapping?.points).toHaveLength(4);
  });
});
