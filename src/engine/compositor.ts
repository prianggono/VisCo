import type { Layer } from "../domain/layer.js";
import type { ProgramState } from "./program-engine.js";
import { getLayerRenderStyle, type LayerRenderStyle } from "./layer-renderer.js";

export interface CompositedLayer {
  readonly layerId: string;
  readonly style: LayerRenderStyle;
}

/**
 * Composition stage for one Layer. It consumes the Layer directly and never
 * stores a second Transform state.
 */
export function compositeLayer(layer: Layer): CompositedLayer {
  return {
    layerId: layer.id,
    style: getLayerRenderStyle(layer)
  };
}

/**
 * Program composition entry point.
 * Program.layers is the canonical multi-Layer runtime state.
 */
export function compositeProgram(program: ProgramState): readonly CompositedLayer[] {
  return program.layers.map(({ layer }) => compositeLayer(layer));
}

/**
 * Explicit single-Layer compatibility helper for consumers that only need
 * the first Program Layer.
 */
export function compositeProgramFirst(program: ProgramState): CompositedLayer | null {
  return program.layers[0] ? compositeLayer(program.layers[0].layer) : null;
}
