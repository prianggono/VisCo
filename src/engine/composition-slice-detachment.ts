import type { Composition } from "../domain/composition.js";
import type { ProjectSnapshot } from "../persistence/project.js";

export interface DetachSliceFromCompositionOptions {
  readonly compositionId: string;
  readonly sliceId: string;
}

export interface DetachSliceFromCompositionResult {
  readonly project: ProjectSnapshot;
  readonly composition: Composition;
}

/**
 * Explicitly detaches a Slice from a Composition.
 *
 * The Slice object and its Layer mappings are preserved. Only Composition
 * membership is changed.
 */
export function detachSliceFromComposition(
  project: ProjectSnapshot,
  options: DetachSliceFromCompositionOptions
): DetachSliceFromCompositionResult {
  const compositionIndex = project.compositions.findIndex(
    (composition) => composition.id === options.compositionId
  );
  if (compositionIndex < 0) {
    throw new Error(
      `Composition "${options.compositionId}" does not exist in the project.`
    );
  }

  const composition = project.compositions[compositionIndex];

  if (composition.locked) {
    throw new Error(
      `Composition "${options.compositionId}" is locked and cannot be changed.`
    );
  }

  if (!composition.sliceIds.includes(options.sliceId)) {
    throw new Error(
      `Slice "${options.sliceId}" is not attached to Composition "${options.compositionId}".`
    );
  }

  const updatedComposition: Composition = {
    ...composition,
    sliceIds: composition.sliceIds.filter((sliceId) => sliceId !== options.sliceId)
  };

  const compositions = project.compositions.map((candidate, index) =>
    index === compositionIndex ? updatedComposition : candidate
  );

  return {
    project: {
      ...project,
      compositions
    },
    composition: updatedComposition
  };
}
