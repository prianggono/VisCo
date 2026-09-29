import type { Slice, SliceMapping, SlicePoint, SliceTransform } from "../domain/slice.js";

export function patchSliceTransform(slice: Slice, patch: Partial<SliceTransform>): Slice {
  if (slice.locked) throw new Error(`Slice "${slice.id}" is locked.`);
  return { ...slice, transform: { ...slice.transform, ...patch } };
}

export function patchSliceMapping(slice: Slice, patch: Partial<SliceMapping>): Slice {
  if (slice.locked) throw new Error(`Slice "${slice.id}" is locked.`);
  const mapping = { ...(slice.mapping ?? { mode: "rectangle" as const }), ...patch };
  if (mapping.mode === "corner-pin" && (mapping.points?.length ?? 0) !== 4) {
    throw new Error("Corner-pin mapping requires exactly 4 points.");
  }
  if (mapping.mode === "polygon" && (mapping.points?.length ?? 0) < 3) {
    throw new Error("Polygon mapping requires at least 3 points.");
  }
  return { ...slice, mapping };
}

export function setSlicePoints(slice: Slice, points: readonly SlicePoint[]): Slice {
  return patchSliceMapping(slice, { points: [...points] });
}

export function assignLayerToSlice(slice: Slice, layerId: string): Slice {
  if (slice.locked) throw new Error(`Slice "${slice.id}" is locked.`);
  if (slice.layerIds.includes(layerId)) return slice;
  return { ...slice, layerIds: [...slice.layerIds, layerId] };
}

export function removeLayerFromSlice(slice: Slice, layerId: string): Slice {
  if (slice.locked) throw new Error(`Slice "${slice.id}" is locked.`);
  return { ...slice, layerIds: slice.layerIds.filter((id) => id !== layerId) };
}
