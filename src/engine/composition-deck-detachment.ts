import type { Composition } from "../domain/composition.js";
import type { ProjectSnapshot } from "../persistence/project.js";

export interface DetachDeckFromCompositionOptions {
  readonly compositionId: string;
  readonly deckId: string;
}

export interface DetachDeckFromCompositionResult {
  readonly project: ProjectSnapshot;
  readonly composition: Composition;
}

/**
 * Explicitly detaches a Deck from a Composition.
 *
 * The operation is intentionally conservative: a Deck cannot be detached
 * while Composition-owned Slices or Composition-scoped Outputs still refer
 * to that Deck. Those relationships must be changed explicitly first.
 */
export function detachDeckFromComposition(
  project: ProjectSnapshot,
  options: DetachDeckFromCompositionOptions
): DetachDeckFromCompositionResult {
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

  if (!composition.deckIds.includes(options.deckId)) {
    throw new Error(
      `Deck "${options.deckId}" is not attached to Composition "${options.compositionId}".`
    );
  }

  const mappedSlice = project.slices.find(
    (slice) =>
      composition.sliceIds.includes(slice.id) &&
      slice.layerRefs.some((ref) => ref.deckId === options.deckId)
  );
  if (mappedSlice) {
    throw new Error(
      `Deck "${options.deckId}" cannot be detached because Slice "${mappedSlice.id}" still references it.`
    );
  }

  const routedOutput = project.outputs.find(
    (output) =>
      output.compositionId === options.compositionId &&
      output.deckId === options.deckId
  );
  if (routedOutput) {
    throw new Error(
      `Deck "${options.deckId}" cannot be detached because Output "${routedOutput.id}" still targets it in Composition "${options.compositionId}".`
    );
  }

  const updatedComposition: Composition = {
    ...composition,
    deckIds: composition.deckIds.filter((deckId) => deckId !== options.deckId)
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
