import type { Group } from "../domain/group.js";
import type { Layer } from "../domain/layer.js";
import type { CompositedLayer } from "./compositor.js";

export interface LayerCompositionInput {
  readonly layers: readonly Layer[];
  readonly groups?: readonly Group[];
}

/**
 * Returns the render order without mutating domain state.
 * Explicit Layer.order is primary; original array position is the stable tie-breaker.
 * Group membership is organizational and does not duplicate Layer state.
 */
export function orderLayers(input: LayerCompositionInput): readonly Layer[] {
  const positions = new Map(input.layers.map((layer, index) => [layer.id, index]));
  return [...input.layers].sort((a, b) => {
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    if (orderA !== orderB) return orderA - orderB;

    const positionA = positions.get(a.id) ?? 0;
    const positionB = positions.get(b.id) ?? 0;
    return positionA - positionB;
  });
}

export function compositeLayers(input: LayerCompositionInput): readonly CompositedLayer[] {
  return orderLayers(input).map((layer) => ({
    layerId: layer.id,
    style: {
      transform: "",
      opacity: layer.transform?.opacity ?? 100,
      transformOrigin: "center center" as const,
      zIndex: layer.order ?? 0,
      mixBlendMode: "normal" as const
    },
    renderOrder: layer.order ?? 0
  }));
}
