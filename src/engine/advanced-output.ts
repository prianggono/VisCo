import type { Composition } from "../domain/composition.js";
import type { OutputTarget } from "../domain/output.js";
import type { Scene } from "../domain/scene.js";
import type { Slice } from "../domain/slice.js";

export interface AdvancedOutputRoute {
  readonly sceneId: string;
  readonly compositionId: string;
  readonly outputId: string;
  readonly sliceIds: readonly string[];
  readonly slices: readonly Slice[];
}

/**
 * Resolves an Advanced Output scene into one deterministic routing plan.
 * Mapping remains data-driven: Slice owns geometry, Scene selects slices,
 * and OutputTarget owns the physical/media destination.
 */
export function resolveAdvancedOutput(
  scene: Scene,
  composition: Composition,
  outputs: readonly OutputTarget[],
  slices: readonly Slice[]
): AdvancedOutputRoute {
  if (scene.compositionId !== composition.id) {
    throw new Error(`Scene "${scene.id}" belongs to composition "${scene.compositionId}", not "${composition.id}".`);
  }
  if (!scene.enabled) throw new Error(`Scene "${scene.id}" is disabled.`);

  const outputId = scene.target.kind === "display" ? scene.target.displayId : "production";
  const output = outputs.find((item) => item.id === outputId);
  if (!output) throw new Error(`Scene "${scene.id}" targets missing output "${outputId}".`);
  if (!output.enabled) throw new Error(`Output "${outputId}" is disabled.`);

  if (scene.target.kind === "display" && output.kind !== "display") {
    throw new Error(`Scene "${scene.id}" requires display output "${outputId}".`);
  }
  if (scene.target.kind === "production" && output.kind !== "media") {
    throw new Error(`Scene "${scene.id}" requires media output "${outputId}".`);
  }
  if (output.compositionId !== undefined && output.compositionId !== composition.id) {
    throw new Error(`Output "${outputId}" belongs to composition "${output.compositionId}", not "${composition.id}".`);
  }

  const compositionSliceIds = new Set(composition.sliceIds);
  const available = new Map(slices.filter((slice) => compositionSliceIds.has(slice.id)).map((slice) => [slice.id, slice]));
  const selectedIds = scene.sliceIds === undefined ? composition.sliceIds : scene.sliceIds;

  for (const sliceId of selectedIds) {
    if (!compositionSliceIds.has(sliceId)) {
      throw new Error(`Scene "${scene.id}" references slice "${sliceId}" outside composition "${composition.id}".`);
    }
    if (!available.has(sliceId)) {
      throw new Error(`Scene "${scene.id}" references missing slice "${sliceId}".`);
    }
  }

  return {
    sceneId: scene.id,
    compositionId: composition.id,
    outputId,
    sliceIds: [...selectedIds],
    slices: selectedIds.map((sliceId) => available.get(sliceId)!)
  };
}
