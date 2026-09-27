import type { Composition } from "../domain/composition.js";
import type { ProjectSnapshot } from "../persistence/project.js";

export interface AttachSliceToCompositionOptions {
  readonly compositionId: string;
  readonly sliceId: string;
  readonly index?: number;
}

export interface AttachSliceToCompositionResult {
  readonly project: ProjectSnapshot;
  readonly composition: Composition;
}

/**
 * Explicitly attaches an existing Slice to an existing Composition.
 *
 * Slice mapping itself remains owned by the Slice. This operation only
 * establishes Composition membership.
 */
export function attachSliceToComposition(
  project: ProjectSnapshot,
  options: AttachSliceToCompositionOptions
): AttachSliceToCompositionResult {
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

  if (!project.slices.some((slice) => slice.id === options.sliceId)) {
    throw new Error(
      `Slice "${options.sliceId}" does not exist in the project.`
    );
  }

  if (composition.sliceIds.includes(options.sliceId)) {
    throw new Error(
      `Slice "${options.sliceId}" is already attached to Composition "${options.compositionId}".`
    );
  }

  const sliceIds = [...composition.sliceIds];

  if (options.index === undefined) {
    sliceIds.push(options.sliceId);
  } else {
    if (
      !Number.isInteger(options.index) ||
      options.index < 0 ||
      options.index > sliceIds.length
    ) {
      throw new Error(
        `Slice attachment index ${options.index} is out of range for Composition "${options.compositionId}".`
      );
    }
    sliceIds.splice(options.index, 0, options.sliceId);
  }

  const updatedComposition: Composition = {
    ...composition,
    sliceIds
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
