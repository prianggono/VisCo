import type { Layer } from "../domain/layer.js";
import type { ProgramState } from "./program-engine.js";
import { getLayerRenderStyle, type LayerRenderStyle } from "./layer-renderer.js";

export interface CompositedLayer {
  readonly layerId: string;
  readonly style: LayerRenderStyle;
  readonly renderOrder: number;
}

export function compositeLayer(layer: Layer, renderOrder = layer.order ?? 0): CompositedLayer {
  return { layerId: layer.id, style: getLayerRenderStyle(layer), renderOrder };
}

/** CPU-side composition contract; GPU work is delegated to the native renderer. */
export function compositeLayersForRender(layers: readonly Layer[]): readonly CompositedLayer[] {
  const positions = new Map(layers.map((layer, index) => [layer.id, index]));
  return [...layers]
    .sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0);
    })
    .map((layer) => compositeLayer(layer, layer.order ?? 0));
}

export function compositeProgram(program: ProgramState): readonly CompositedLayer[] {
  const layers = program.layers.length > 0 ? program.layers : (program.layer ? [program.layer] : []);
  return compositeLayersForRender(layers);
}
