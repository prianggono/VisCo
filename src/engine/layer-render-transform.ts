import type { Layer } from "../domain/layer.js";
import {
  getLayerScaleFactors,
  resolveLayerTransform
} from "./layer-transform.js";

export interface LayerRenderTransform {
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotation: number;
  readonly opacity: number;
}

/**
 * Renderer-facing transform. It is derived directly from Layer.transform.
 * No second transform state is stored here.
 */
export function getLayerRenderTransform(layer: Layer): LayerRenderTransform {
  const transform = resolveLayerTransform(layer.transform);
  const scale = getLayerScaleFactors(transform);

  return {
    x: transform.x,
    y: transform.y,
    scaleX: scale.x,
    scaleY: scale.y,
    rotation: transform.rotation,
    opacity: transform.opacity / 100
  };
}
