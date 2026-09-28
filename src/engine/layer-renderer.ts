import type { Layer } from "../domain/layer.js";
import { getLayerRenderTransform } from "./layer-render-transform.js";

export type LayerBlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "color-dodge" | "color-burn" | "hard-light" | "soft-light" | "difference" | "exclusion";

export interface LayerRenderStyle {
  readonly transform: string;
  readonly opacity: number;
  readonly transformOrigin: "center center";
  readonly zIndex: number;
  readonly mixBlendMode: LayerBlendMode;
  readonly objectFit: "contain" | "cover" | "fill";
  /** Optional transient clip applied by the renderer during a transition. */
  readonly clipPath?: string;
}

const resolveBlendMode = (blendMode?: string): LayerBlendMode => {
  const normalized = (blendMode ?? "Normal").trim().toLowerCase();
  if (normalized === "normal") return "normal";
  const supported: readonly LayerBlendMode[] = [
    "multiply", "screen", "overlay", "darken", "lighten",
    "color-dodge", "color-burn", "hard-light", "soft-light",
    "difference", "exclusion"
  ];
  return supported.includes(normalized as LayerBlendMode)
    ? normalized as LayerBlendMode
    : "normal";
};

const resolveObjectFit = (fitMode?: Layer["fitMode"]): "contain" | "cover" | "fill" => {
  if (fitMode === "fill") return "cover";
  if (fitMode === "stretch") return "fill";
  return "contain";
};

export function getLayerRenderStyle(layer: Layer): LayerRenderStyle {
  const transform = getLayerRenderTransform(layer);
  return {
    transform: "translate(-50%, -50%) translate(" + transform.x + "px, " + transform.y + "px) rotate(" + transform.rotation + "deg) scale(" + transform.scaleX + ", " + transform.scaleY + ")",
    opacity: transform.opacity,
    transformOrigin: "center center",
    zIndex: layer.order ?? 0,
    mixBlendMode: resolveBlendMode(layer.blendMode),
    objectFit: resolveObjectFit(layer.fitMode)
  };
}
