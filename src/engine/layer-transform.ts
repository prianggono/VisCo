import type { LayerTransform } from "../domain/layer.js";

export const DEFAULT_LAYER_TRANSFORM: LayerTransform = Object.freeze({
  x: 0,
  y: 0,
  scaleX: 100,
  scaleY: 100,
  scaleLinked: true,
  rotation: 0,
  opacity: 100
});

export type LayerScaleAxis = "scaleX" | "scaleY";

export function resolveLayerTransform(transform?: Partial<LayerTransform>): LayerTransform {
  return {
    ...DEFAULT_LAYER_TRANSFORM,
    ...transform
  };
}

export function patchLayerTransform(
  transform: LayerTransform | undefined,
  patch: Partial<LayerTransform>
): LayerTransform {
  return {
    ...resolveLayerTransform(transform),
    ...patch
  };
}

export function setLayerScale(
  transform: LayerTransform | undefined,
  axis: LayerScaleAxis,
  value: number
): LayerTransform {
  const current = resolveLayerTransform(transform);

  if (!current.scaleLinked) {
    return { ...current, [axis]: value };
  }

  const otherAxis: LayerScaleAxis = axis === "scaleX" ? "scaleY" : "scaleX";
  const currentAxisValue = current[axis];
  const currentOtherValue = current[otherAxis];
  const ratio = currentAxisValue !== 0 ? currentOtherValue / currentAxisValue : 1;
  const linkedOtherValue = Math.round(value * ratio * 100) / 100;

  return {
    ...current,
    [axis]: value,
    [otherAxis]: linkedOtherValue
  };
}

/** Convert percentage scale values into renderer-space scale factors. */
export function getLayerScaleFactors(transform: LayerTransform | undefined): {
  readonly x: number;
  readonly y: number;
} {
  const resolved = resolveLayerTransform(transform);
  return {
    x: resolved.scaleX / 100,
    y: resolved.scaleY / 100
  };
}
