import type { Layer } from "../domain/layer.js";
import { getLayerRenderStyle, type LayerRenderStyle } from "./layer-renderer.js";

export interface CompositedLayer {
  readonly layerId: string;
  readonly style: LayerRenderStyle;
}

/**
 * Composition stage for a single Layer. It consumes the Layer directly and
 * never stores a second Transform state.
 */
export function compositeLayer(layer: Layer): CompositedLayer {
  return {
    layerId: layer.id,
    style: getLayerRenderStyle(layer)
  };
}
