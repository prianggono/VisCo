import type { Scene } from "../domain/scene.js";
import type { Slice } from "../domain/slice.js";
import type { ProgramState } from "./program-engine.js";
import type { OutputFrame } from "./output-frame.js";

export function createOutputFrame(
  program: ProgramState,
  scene: Scene,
  format: { readonly width: number; readonly height: number; readonly fps: number },
  frameNumber: number,
  slices: readonly Slice[] = []
): OutputFrame {
  if (scene.compositionId !== program.compositionId) {
    throw new Error(`Scene "${scene.id}" belongs to composition "${scene.compositionId}", not "${program.compositionId}".`);
  }
  if (!scene.enabled) throw new Error(`Scene "${scene.id}" is disabled.`);
  if (!Number.isInteger(format.width) || format.width <= 0 || !Number.isInteger(format.height) || format.height <= 0) {
    throw new Error("Output frame dimensions must be positive integers.");
  }
  if (!Number.isFinite(format.fps) || format.fps <= 0 || format.fps > 120) {
    throw new Error("Output frame FPS must be between 0 and 120.");
  }
  if (!Number.isInteger(frameNumber) || frameNumber < 0) {
    throw new Error("Output frame number must be a non-negative integer.");
  }

  const selectedSlices = scene.sliceIds === undefined
    ? slices
    : slices.filter((slice) => scene.sliceIds!.includes(slice.id));

  for (const slice of selectedSlices) {
    const values = [
      slice.transform.x, slice.transform.y, slice.transform.width, slice.transform.height,
      slice.transform.rotation, slice.transform.scaleX, slice.transform.scaleY,
      slice.transform.cropLeft, slice.transform.cropTop, slice.transform.cropRight, slice.transform.cropBottom
    ].filter((value): value is number => value !== undefined);
    if (values.some((value) => !Number.isFinite(value))) {
      throw new Error(`Slice "${slice.id}" contains invalid transform values.`);
    }
    if (slice.transform.width <= 0 || slice.transform.height <= 0) {
      throw new Error(`Slice "${slice.id}" must have positive dimensions.`);
    }
    if (slice.mapping?.points?.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      throw new Error(`Slice "${slice.id}" contains invalid mapping points.`);
    }
  }

  // Slice owns canonical Layer references. A Slice never duplicates Layer state.
  const programLayerIds = new Set(program.layers.map((layer) => layer.id));
  const layerIds = [...new Set(
    selectedSlices.flatMap((slice) => slice.layerRefs
      .filter((ref) => programLayerIds.has(ref.layerId) && ref.deckId === program.source?.deckId)
      .map((ref) => ref.layerId))
  )];

  return {
    source: {
      compositionId: program.compositionId,
      width: format.width,
      height: format.height,
      fps: format.fps,
      frameNumber
    },
    sceneId: scene.id,
    layerIds,
    slices: selectedSlices.map((slice) => ({
      id: slice.id,
      layerRefs: slice.layerRefs.map((ref) => ({ ...ref })),
      transform: { ...slice.transform },
      ...(slice.mapping ? { mapping: {
        mode: slice.mapping.mode,
        ...(slice.mapping.points ? { points: slice.mapping.points.map((point) => ({ ...point })) } : {})
      } } : {})
    }))
  };
}
