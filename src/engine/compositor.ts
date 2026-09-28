import type { Layer } from "../domain/layer.js";
import type { ProgramState } from "./program-engine.js";
import { getLayerRenderStyle, type LayerRenderStyle } from "./layer-renderer.js";
import { compositeLayers } from "./layer-composition.js";

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
  return compositeLayers({ layers }).map((layer) => compositeLayer(layer, layer.order ?? 0));
}

export function compositeProgram(program: ProgramState): readonly CompositedLayer[] {
  const layers = program.layers.length > 0 ? program.layers : (program.layer ? [program.layer] : []);
  return compositeLayersForRender(layers);
}
