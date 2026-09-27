import type { Layer } from "../domain/layer.js";
import type { ProgramState } from "./program-engine.js";
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

/**
 * Program composition entry point. Program remains the source of truth for
 * the active Layer; the compositor only derives render data from it.
 */
export function compositeProgram(program: ProgramState): CompositedLayer | null {
  return program.layer ? compositeLayer(program.layer) : null;
}
