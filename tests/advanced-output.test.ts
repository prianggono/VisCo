import { describe, expect, it } from "vitest";
import { resolveAdvancedOutput } from "../src/engine/advanced-output.js";

const composition = {
  id: "comp-1",
  name: "Main",
  format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 as const },
  deckIds: ["deck-1"],
  groupIds: [],
  sliceIds: ["slice-1", "slice-2"],
  locked: false
};

const slices = [
  { id: "slice-1", name: "Screen A", transform: { x: 0, y: 0, width: 960, height: 1080, rotation: 0 }, locked: false },
  { id: "slice-2", name: "Screen B", transform: { x: 960, y: 0, width: 960, height: 1080, rotation: 0 }, layerIds: ["layer-1"], locked: false }
];

describe("advanced output", () => {
  it("maps all composition slices when Scene has no explicit selection", () => {
    const route = resolveAdvancedOutput(
      { id: "scene-1", name: "Display 1", compositionId: "comp-1", target: { kind: "display", displayId: "display-1" }, enabled: true },
      composition,
      [{ id: "display-1", kind: "display", enabled: true, compositionId: "comp-1" }],
      slices
    );
    expect(route.outputId).toBe("display-1");
    expect(route.sliceIds).toEqual(["slice-1", "slice-2"]);
  });

  it("honors Scene slice selection without copying Slice state", () => {
    const route = resolveAdvancedOutput(
      { id: "scene-1", name: "Display 1", compositionId: "comp-1", target: { kind: "display", displayId: "display-1" }, sliceIds: ["slice-2"], enabled: true },
      composition,
      [{ id: "display-1", kind: "display", enabled: true, compositionId: "comp-1" }],
      slices
    );
    expect(route.slices).toHaveLength(1);
    expect(route.slices[0]?.id).toBe("slice-2");
    expect(route.slices[0]?.transform.x).toBe(960);
  });

  it("rejects a Scene slice outside its Composition", () => {
    expect(() => resolveAdvancedOutput(
      { id: "scene-1", name: "Display 1", compositionId: "comp-1", target: { kind: "display", displayId: "display-1" }, sliceIds: ["slice-3"], enabled: true },
      composition,
      [{ id: "display-1", kind: "display", enabled: true, compositionId: "comp-1" }],
      slices
    )).toThrow(/outside composition/);
  });

  it("rejects a disabled physical output", () => {
    expect(() => resolveAdvancedOutput(
      { id: "scene-1", name: "Display 1", compositionId: "comp-1", target: { kind: "display", displayId: "display-1" }, enabled: true },
      composition,
      [{ id: "display-1", kind: "display", enabled: false, compositionId: "comp-1" }],
      slices
    )).toThrow(/disabled/);
  });
});
