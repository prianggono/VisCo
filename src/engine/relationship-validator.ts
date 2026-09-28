import type { Composition } from "../domain/composition.js";
import type { Channel } from "../domain/channel.js";
import type { Deck, DeckLayerRef } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import type { Slice } from "../domain/slice.js";
import type { Library, Source } from "../domain/source.js";
import type { OutputTarget } from "../domain/output.js";

export interface RelationshipValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface RelationshipGraph {
  readonly compositions: readonly Composition[];
  readonly channels?: readonly Channel[];
  readonly decks: readonly Deck[];
  readonly groups: readonly Group[];
  readonly slices: readonly Slice[];
  readonly sources?: readonly Source[];
  /** Optional Library index. When supplied, it must match the canonical Source registry exactly. */
  readonly library?: Library;
  readonly outputs?: readonly OutputTarget[];
}

function hasDeckLayer(deck: Deck | undefined, layerId: string): boolean {
  return Boolean(deck?.layers.some((layer) => layer.id === layerId));
}

function hasDeckLayerRef(decks: Map<string, Deck>, ref: DeckLayerRef): boolean {
  return hasDeckLayer(decks.get(ref.deckId), ref.layerId);
}

export function validateRelationships(graph: RelationshipGraph): RelationshipValidationResult {
  const errors: string[] = [];
  const decksById = new Map(graph.decks.map((item) => [item.id, item]));
  const deckIds = new Set(graph.decks.map((item) => item.id));
  const sliceIds = new Set(graph.slices.map((item) => item.id));
  const sourceIds = new Set((graph.sources ?? []).map((item) => item.id));
  const librarySourceIds = graph.library?.sourceIds;

  if (librarySourceIds) {
    const seenLibrarySourceIds = new Set<string>();
    for (const sourceId of librarySourceIds) {
      if (seenLibrarySourceIds.has(sourceId)) {
        errors.push(`Library contains duplicate Source ID "${sourceId}".`);
      }
      seenLibrarySourceIds.add(sourceId);
      if (!sourceIds.has(sourceId)) {
        errors.push(`Library references missing Source "${sourceId}".`);
      }
    }

    for (const sourceId of sourceIds) {
      if (!seenLibrarySourceIds.has(sourceId)) {
        errors.push(`Source "${sourceId}" is missing from Library index.`);
      }
    }
  }

  const duplicateIds = <T extends { readonly id: string }>(items: readonly T[], kind: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) errors.push(`Duplicate ${kind} ID "${item.id}".`);
      seen.add(item.id);
    }
  };

  duplicateIds(graph.compositions, "Composition");
  duplicateIds(graph.channels ?? [], "Channel");
  duplicateIds(graph.decks, "Deck");
  duplicateIds(graph.groups, "Group");
  duplicateIds(graph.slices, "Slice");
  duplicateIds(graph.sources ?? [], "Source");
  duplicateIds(graph.outputs ?? [], "Output");

  for (const deck of graph.decks) {
    const layerIds = new Set<string>();
    for (const layer of deck.layers) {
      if (layerIds.has(layer.id)) {
        errors.push(`Deck "${deck.id}" contains duplicate Layer ID "${layer.id}".`);
      }
      layerIds.add(layer.id);
    }
  }

  const compositionIds = new Set(graph.compositions.map((item) => item.id));

  for (const output of graph.outputs ?? []) {
    if (output.compositionId !== undefined && !compositionIds.has(output.compositionId)) {
      errors.push(`Output "${output.id}" references missing Composition "${output.compositionId}".`);
    }
    if (output.deckId !== undefined && !deckIds.has(output.deckId)) {
      errors.push(`Output "${output.id}" references missing Deck "${output.deckId}".`);
    }
    if (output.compositionId !== undefined && output.deckId !== undefined) {
      const composition = graph.compositions.find((item) => item.id === output.compositionId);
      if (composition && !composition.deckIds.includes(output.deckId)) {
        errors.push(
          `Output "${output.id}" targets Deck "${output.deckId}", but that Deck is not attached to Composition "${output.compositionId}".`
        );
      }
    }
    if (output.media?.compositionId !== undefined && !compositionIds.has(output.media.compositionId)) {
      errors.push(`Output "${output.id}" media settings reference missing Composition "${output.media.compositionId}".`);
    }
  }

  for (const channel of graph.channels ?? []) {
    for (const deckId of channel.deckIds) {
      if (!deckIds.has(deckId)) errors.push(`Channel "${channel.id}" references missing deck "${deckId}".`);
    }
  }

  for (const composition of graph.compositions) {
    for (const deckId of composition.deckIds) {
      if (!deckIds.has(deckId)) errors.push(`Composition "${composition.id}" references missing deck "${deckId}".`);
    }
    for (const sliceId of composition.sliceIds) {
      if (!sliceIds.has(sliceId)) errors.push(`Composition "${composition.id}" references missing slice "${sliceId}".`);
    }
  }

  for (const deck of graph.decks) {
    for (const layer of deck.layers) {
      if (layer.sourceId != null && !sourceIds.has(layer.sourceId)) errors.push(`Layer "${layer.id}" references missing source "${layer.sourceId}".`);
    }

    for (const groupId of deck.groupIds ?? []) {
      const group = graph.groups.find((item) => item.id === groupId);
      if (!group) {
        errors.push(`Deck "${deck.id}" references missing group "${groupId}".`);
        continue;
      }
      if (group.deckId !== deck.id) {
        errors.push(`Group "${group.id}" belongs to deck "${group.deckId}" but is referenced by deck "${deck.id}".`);
      }
    }
  }

  for (const group of graph.groups) {
    const owner = decksById.get(group.deckId);
    if (!owner) {
      errors.push(`Group "${group.id}" references missing deck "${group.deckId}".`);
      continue;
    }
    for (const layerId of group.layerIds) {
      if (!hasDeckLayer(owner, layerId)) {
        errors.push(`Group "${group.id}" references missing layer "${layerId}" in deck "${group.deckId}".`);
      }
    }
  }

  const compositionsBySliceId = new Map<string, Composition[]>();
  for (const composition of graph.compositions) {
    for (const sliceId of composition.sliceIds) {
      const owners = compositionsBySliceId.get(sliceId) ?? [];
      owners.push(composition);
      compositionsBySliceId.set(sliceId, owners);
    }
  }

  for (const slice of graph.slices) {
    for (const ref of slice.layerRefs) {
      if (!hasDeckLayerRef(decksById, ref)) {
        errors.push(`Slice "${slice.id}" references missing layer "${ref.layerId}" in deck "${ref.deckId}".`);
        continue;
      }

      const owners = compositionsBySliceId.get(slice.id) ?? [];
      for (const composition of owners) {
        if (!composition.deckIds.includes(ref.deckId)) {
          errors.push(
            `Slice "${slice.id}" maps deck "${ref.deckId}", but that deck is not attached to Composition "${composition.id}".`
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
