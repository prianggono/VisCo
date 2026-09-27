import type { Composition } from "../domain/composition.js";
import type { DeckLayerRef, Layer } from "../domain/deck.js";
import type { Slice, SliceTransform } from "../domain/slice.js";
import type { ProgramState } from "./program-engine.js";

export interface ResolvedCompositionLayer {
  readonly ref: DeckLayerRef;
  readonly layer: Layer;
}

export interface ResolvedCompositionSlice {
  readonly sliceId: string;
  readonly transform: SliceTransform;
  readonly layers: readonly ResolvedCompositionLayer[];
}

/**
 * Resolves the current Program into the static Composition/Slice mapping.
 *
 * Composition owns Slice membership, Slice owns Deck/Layer mapping, and
 * Program owns which Layers are currently active. No relationship is copied
 * into a second state store.
 */
export function resolveCompositionProgram(
  composition: Composition,
  slices: readonly Slice[],
  program: ProgramState
): readonly ResolvedCompositionSlice[] {
  if (program.compositionId !== composition.id) {
    throw new Error(
      `Program composition "${program.compositionId}" does not match Composition "${composition.id}".`
    );
  }

  const sliceById = new Map(slices.map((slice) => [slice.id, slice]));
  const activeByRef = new Map(
    program.layers.map(({ source, layer }) => [
      source.deckId + ":" + source.layerId,
      { ref: source, layer }
    ])
  );

  return composition.sliceIds.map((sliceId) => {
    const slice = sliceById.get(sliceId);
    if (!slice) {
      throw new Error(
        "Composition \"" + composition.id + "\" references missing Slice \"" + sliceId + "\"."
      );
    }

    const seen = new Set<string>();
    const layers = slice.layerRefs.flatMap((ref) => {
      if (!composition.deckIds.includes(ref.deckId)) {
        throw new Error(
          `Slice "${slice.id}" maps deck "${ref.deckId}", but that deck is not attached to Composition "${composition.id}".`
        );
      }
      const key = ref.deckId + ":" + ref.layerId;
      if (seen.has(key)) {
        throw new Error(
          "Slice \"" + slice.id + "\" contains duplicate Layer reference \"" +
            ref.deckId + "/" + ref.layerId + "\"."
        );
      }
      seen.add(key);

      const active = activeByRef.get(key);
      return active ? [active] : [];
    });

    return {
      sliceId: slice.id,
      transform: slice.transform,
      layers
    };
  });
}
