import type { Composition } from "../domain/composition.js";
import type { ProjectSnapshot } from "../persistence/project.js";

export interface AttachDeckToCompositionOptions {
  readonly compositionId: string;
  readonly deckId: string;
  readonly index?: number;
}

export interface AttachDeckToCompositionResult {
  readonly project: ProjectSnapshot;
  readonly composition: Composition;
}

/**
 * Explicitly attaches an existing Deck to an existing Composition.
 *
 * This is a presentation-configuration operation only. It does not modify
 * Channels, Outputs, Slices, Program state, Preview state, or runtime state.
 */
export function attachDeckToComposition(
  project: ProjectSnapshot,
  options: AttachDeckToCompositionOptions
): AttachDeckToCompositionResult {
  const compositionIndex = project.compositions.findIndex(
    (composition) => composition.id === options.compositionId
  );
  if (compositionIndex < 0) {
    throw new Error(
      `Composition "${options.compositionId}" does not exist in the project.`
    );
  }

  if (!project.decks.some((deck) => deck.id === options.deckId)) {
    throw new Error(
      `Deck "${options.deckId}" does not exist in the project.`
    );
  }

  const composition = project.compositions[compositionIndex];
  if (composition.deckIds.includes(options.deckId)) {
    throw new Error(
      `Deck "${options.deckId}" is already attached to Composition "${options.compositionId}".`
    );
  }

  const deckIds = [...composition.deckIds];

  if (options.index === undefined) {
    deckIds.push(options.deckId);
  } else {
    if (
      !Number.isInteger(options.index) ||
      options.index < 0 ||
      options.index > deckIds.length
    ) {
      throw new Error(
        `Deck attachment index ${options.index} is out of range for Composition "${options.compositionId}".`
      );
    }
    deckIds.splice(options.index, 0, options.deckId);
  }

  const updatedComposition: Composition = {
    ...composition,
    deckIds
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
