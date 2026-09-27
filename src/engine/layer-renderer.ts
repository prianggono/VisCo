import type { Layer } from "../domain/layer.js";
import { getLayerRenderTransform } from "./layer-render-transform.js";

export interface LayerRenderStyle {
  readonly transform: string;
  readonly opacity: number;
  readonly transformOrigin: "center center";
}

export function getLayerRenderStyle(layer: Layer): LayerRenderStyle {
  const transform = getLayerRenderTransform(layer);
  return {
    transform: "translate(" + transform.x + "px, " + transform.y + "px) rotate(" + transform.rotation + "deg) scale(" + transform.scaleX + ", " + transform.scaleY + ")",
    opacity: transform.opacity,
    transformOrigin: "center center"
  };
}
