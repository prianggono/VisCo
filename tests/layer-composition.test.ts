import { describe, expect, it } from "vitest";
import { compositeLayers, orderLayers } from "../src/engine/layer-composition.js";

describe("Layer composition", () => {
  it("orders by explicit order and preserves stable insertion order for ties", () => {
    const layers = [
      { id: "a", name: "A", order: 2 },
      { id: "b", name: "B", order: 1 },
      { id: "c", name: "C", order: 1 },
      { id: "d", name: "D" }
    ];

    expect(orderLayers({ layers }).map((layer) => layer.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("does not duplicate or reorder Layer state because of Group membership", () => {
    const layers = [
      { id: "a", name: "A", order: 2 },
      { id: "b", name: "B", order: 1 }
    ];

    const groups = [
      { id: "group-1", name: "Camera", layerIds: ["a", "b"], collapsed: true }
    ];

    expect(orderLayers({ layers, groups }).map((layer) => layer.id)).toEqual(["b", "a"]);
  });

  it("composites every ordered Layer", () => {
    const result = compositeLayers({
      layers: [
        { id: "a", name: "A", order: 2 },
        { id: "b", name: "B", order: 1 }
      ]
    });

    expect(result.map((item) => item.layerId)).toEqual(["b", "a"]);
  });
});
