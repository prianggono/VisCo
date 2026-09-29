import type { DeckLayerRef } from "../domain/deck.js";
import type { Slice, SliceMapping, SlicePoint, SliceTransform } from "../domain/slice.js";

export type SliceEditorTool = "move-pick" | "pen";

export interface BezierPoint extends SlicePoint {
  readonly inHandle?: SlicePoint;
  readonly outHandle?: SlicePoint;
}

export interface SliceEditorState {
  readonly tool: SliceEditorTool;
  readonly selectedPointIndex: number | null;
}

export const SLICE_EDITOR_TOOLS = {
  movePick: "move-pick",
  pen: "pen"
} as const;

/** The move/pick cursor returns the operator to normal selection and movement. */
export function setSliceEditorTool(state: SliceEditorState, tool: SliceEditorTool): SliceEditorState {
  return { ...state, tool, selectedPointIndex: null };
}

export function selectSlicePoint(state: SliceEditorState, index: number | null): SliceEditorState {
  return { ...state, selectedPointIndex: index };
}

export function addSlicePoint(slice: Slice, point: SlicePoint, index?: number): Slice {
  if (slice.locked) throw new Error(`Slice "${slice.id}" is locked.`);
  const points = [...(slice.mapping?.points ?? []), point];
  if (index !== undefined) {
    points.splice(Math.max(0, Math.min(index, points.length - 1)), 0, point);
    points.splice(points.length - 1, 1);
  }
  return patchSliceMapping(slice, { points });
}

export function removeSlicePoint(slice: Slice, index: number): Slice {
  if (slice.locked) throw new Error(`Slice "${slice.id}" is locked.`);
  const points = [...(slice.mapping?.points ?? [])];
  if (index < 0 || index >= points.length) throw new Error("Slice point index is out of range.");
  points.splice(index, 1);
  return patchSliceMapping(slice, { points });
}

export function moveSlicePoint(slice: Slice, index: number, point: SlicePoint): Slice {
  const points = [...(slice.mapping?.points ?? [])];
  if (index < 0 || index >= points.length) throw new Error("Slice point index is out of range.");
  points[index] = point;
  return patchSliceMapping(slice, { points });
}

export function setBezierHandles(slice: Slice, index: number, handles: { readonly inHandle?: SlicePoint; readonly outHandle?: SlicePoint }): Slice {
  const mapping = slice.mapping;
  const points = [...(mapping?.points ?? [])] as BezierPoint[];
  if (index < 0 || index >= points.length) throw new Error("Slice point index is out of range.");
  points[index] = { ...points[index], ...handles };
  return patchSliceMapping(slice, { mode: "bezier", points });
}

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

export function assignLayerToSlice(slice: Slice, layerRef: DeckLayerRef): Slice {
  if (slice.locked) throw new Error(`Slice "${slice.id}" is locked.`);
  if (slice.layerRefs.some((ref) => ref.deckId === layerRef.deckId && ref.layerId === layerRef.layerId)) return slice;
  return { ...slice, layerRefs: [...slice.layerRefs, { ...layerRef }] };
}

export function removeLayerFromSlice(slice: Slice, layerRef: DeckLayerRef): Slice {
  if (slice.locked) throw new Error(`Slice "${slice.id}" is locked.`);
  return {
    ...slice,
    layerRefs: slice.layerRefs.filter((ref) => !(ref.deckId === layerRef.deckId && ref.layerId === layerRef.layerId))
  };
}
