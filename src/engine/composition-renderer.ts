import type { Composition } from "../domain/composition.js";
import type { SliceTransform } from "../domain/slice.js";
import type { LayerRenderStyle } from "./layer-renderer.js";
import { getLayerRenderStyle } from "./layer-renderer.js";
import {
  resolveCompositionProgram,
  type ResolvedCompositionSlice
} from "./composition-program-resolver.js";
import type { Slice } from "../domain/slice.js";
import type { ProgramState } from "./program-engine.js";

export interface CompositionSliceRenderStyle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

export interface RenderedCompositionLayer {
  readonly sliceId: string;
  readonly ref: import("../domain/deck.js").DeckLayerRef;
  readonly layerId: string;
  readonly layerStyle: LayerRenderStyle;
  readonly sliceStyle: CompositionSliceRenderStyle;
}

function toSliceRenderStyle(transform: SliceTransform): CompositionSliceRenderStyle {
  return {
    x: transform.x,
    y: transform.y,
    width: transform.width,
    height: transform.height,
    rotation: transform.rotation
  };
}

function renderSlice(
  slice: ResolvedCompositionSlice
): readonly RenderedCompositionLayer[] {
  const sliceStyle = toSliceRenderStyle(slice.transform);

  return slice.layers.map(({ ref, layer }) => ({
    sliceId: slice.sliceId,
    ref,
    layerId: layer.id,
    layerStyle: getLayerRenderStyle(layer),
    sliceStyle
  }));
}

/**
 * Produces the render plan for the active Program inside a Composition.
 *
 * Layer transform remains owned by Layer. Slice transform remains owned by
 * Slice. This function only combines their current values for rendering.
 */
export function renderCompositionProgram(
  composition: Composition,
  slices: readonly Slice[],
  program: ProgramState
): readonly RenderedCompositionLayer[] {
  return resolveCompositionProgram(composition, slices, program).flatMap(renderSlice);
}
