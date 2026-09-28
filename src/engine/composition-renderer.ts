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


export interface CompositionTransitionRenderPlan {
  readonly layers: readonly RenderedCompositionLayer[];
  readonly active: boolean;
  readonly progress: number;
}

/**
 * Applies the runtime transition to two already-resolved Composition render
 * plans. Transition ownership remains on Deck/TransitionEngine; this function
 * only converts runtime progress into render instructions.
 */
export function renderCompositionTransition(
  previousPlan: readonly RenderedCompositionLayer[] | null,
  currentPlan: readonly RenderedCompositionLayer[],
  transition: import("./transition-engine.js").TransitionProgress | null
): CompositionTransitionRenderPlan {
  if (!transition || !transition.active || transition.progress >= 1 || transition.transition.type === "cut" || !previousPlan) {
    return { layers: currentPlan, active: false, progress: transition?.progress ?? 1 };
  }

  const progress = Math.max(0, Math.min(1, transition.progress));

  // Transition output is a temporary render stack. Keep each plan's internal
  // Layer ordering, but place the incoming plan above every outgoing Layer so
  // Fade/Wipe cannot be hidden by an old Layer with a larger z-index.
  const previousMaxZ = previousPlan.reduce(
    (max, item) => Math.max(max, item.layerStyle.zIndex),
    Number.NEGATIVE_INFINITY
  );
  const currentMinZ = currentPlan.reduce(
    (min, item) => Math.min(min, item.layerStyle.zIndex),
    Number.POSITIVE_INFINITY
  );
  const zOffset = Number.isFinite(previousMaxZ) && Number.isFinite(currentMinZ)
    ? Math.max(0, previousMaxZ - currentMinZ + 1)
    : 0;

  if (transition.transition.type === "fade") {
    const previous = previousPlan.map((item) => ({
      ...item,
      layerStyle: {
        ...item.layerStyle,
        opacity: item.layerStyle.opacity * (1 - progress)
      }
    }));
    const current = currentPlan.map((item) => ({
      ...item,
      layerStyle: {
        ...item.layerStyle,
        opacity: item.layerStyle.opacity * progress,
        zIndex: item.layerStyle.zIndex + zOffset
      }
    }));
    return { layers: [...previous, ...current], active: true, progress };
  }

  const current = currentPlan.map((item) => ({
    ...item,
    layerStyle: {
      ...item.layerStyle,
      zIndex: item.layerStyle.zIndex + zOffset,
      clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`
    }
  }));
  return { layers: [...previousPlan, ...current], active: true, progress };
}
