import type { DeckLayerRef } from "../domain/deck.js";
import type { Slice } from "../domain/slice.js";
import type { ProjectSnapshot } from "../persistence/project.js";

export interface MapLayerToSliceOptions {
  readonly compositionId: string;
  readonly sliceId: string;
  readonly ref: DeckLayerRef;
}

export interface MapLayerToSliceResult {
  readonly project: ProjectSnapshot;
  readonly slice: Slice;
}

/**
 * Adds an explicit Deck/Layer reference to a Slice.
 *
 * The Slice must belong to the Composition, and the referenced Deck must
 * already be attached to that Composition. Layer identity is always scoped
 * by Deck ID, so identical local Layer IDs in different Decks remain distinct.
 */
export function mapLayerToSlice(
  project: ProjectSnapshot,
  options: MapLayerToSliceOptions
): MapLayerToSliceResult {
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

  if (!composition.deckIds.includes(options.ref.deckId)) {
    throw new Error(
      `Deck "${options.ref.deckId}" is not attached to Composition "${options.compositionId}".`
    );
  }

  const deck = project.decks.find((candidate) => candidate.id === options.ref.deckId);
  if (!deck) {
    throw new Error(`Deck "${options.ref.deckId}" does not exist in the project.`);
  }

  if (!deck.layers.some((layer) => layer.id === options.ref.layerId)) {
    throw new Error(
      `Layer "${options.ref.layerId}" does not exist in Deck "${options.ref.deckId}".`
    );
  }

  if (
    slice.layerRefs.some(
      (ref) =>
        ref.deckId === options.ref.deckId &&
        ref.layerId === options.ref.layerId
    )
  ) {
    throw new Error(
      `Layer "${options.ref.layerId}" in Deck "${options.ref.deckId}" is already mapped to Slice "${options.sliceId}".`
    );
  }

  const updatedSlice: Slice = {
    ...slice,
    layerRefs: [...slice.layerRefs, { ...options.ref }]
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
