import type { Slice } from "../domain/slice.js";
import type { ProjectSnapshot } from "../persistence/project.js";
import type { DeckLayerRef } from "../domain/deck.js";

export interface UnmapLayerFromSliceOptions {
  readonly compositionId: string;
  readonly sliceId: string;
  readonly ref: DeckLayerRef;
}

export interface UnmapLayerFromSliceResult {
  readonly project: ProjectSnapshot;
  readonly slice: Slice;
}

/**
 * Removes one explicit Deck/Layer reference from a Slice.
 * The Deck and Layer themselves are never deleted.
 */
export function unmapLayerFromSlice(
  project: ProjectSnapshot,
  options: UnmapLayerFromSliceOptions
): UnmapLayerFromSliceResult {
  const composition = project.compositions.find(
    (candidate) => candidate.id === options.compositionId
  );
  if (!composition) {
    throw new Error(
      `Composition "${options.compositionId}" does not exist in the project.`
    );
  }

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

  const sliceIndex = project.slices.findIndex(
    (slice) => slice.id === options.sliceId
  );
  if (sliceIndex < 0) {
    throw new Error(
      `Slice "${options.sliceId}" does not exist in the project.`
    );
  }

  const slice = project.slices[sliceIndex];

  if (slice.locked) {
    throw new Error(`Slice "${options.sliceId}" is locked and cannot be changed.`);
  }

  const exists = slice.layerRefs.some(
    (ref) => ref.deckId === options.ref.deckId && ref.layerId === options.ref.layerId
  );
  if (!exists) {
    throw new Error(
      `Layer "${options.ref.layerId}" in Deck "${options.ref.deckId}" is not mapped to Slice "${options.sliceId}".`
    );
  }

  const updatedSlice: Slice = {
    ...slice,
    layerRefs: slice.layerRefs.filter(
      (ref) => !(ref.deckId === options.ref.deckId && ref.layerId === options.ref.layerId)
    )
  };

  const slices = project.slices.map((candidate, index) =>
    index === sliceIndex ? updatedSlice : candidate
  );

  return {
    project: {
      ...project,
      slices
    },
    slice: updatedSlice
  };
}
