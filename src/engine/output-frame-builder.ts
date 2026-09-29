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

  const layerIds = program.layers
    .filter((layer) => slices.length === 0 || slices.some((slice) => slice.layerIds.includes(layer.id)))
    .map((layer) => layer.id);

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
    slices: slices.map((slice) => ({
      id: slice.id,
      layerIds: [...slice.layerIds],
      transform: { ...slice.transform },
      ...(slice.mapping ? { mapping: {
        mode: slice.mapping.mode,
        ...(slice.mapping.points ? { points: slice.mapping.points.map((point) => ({ ...point })) } : {})
      } } : {})
    }))
  };
}
