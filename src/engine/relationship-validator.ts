import type { Composition } from "../domain/composition.js";
import type { Deck } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import type { Layer } from "../domain/layer.js";
import type { Slice } from "../domain/slice.js";
import type { Source } from "../domain/source.js";

export interface RelationshipValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface RelationshipGraph {
  readonly compositions: readonly Composition[];
  readonly decks: readonly Deck[];
  readonly groups: readonly Group[];
  readonly layers: readonly Layer[];
  readonly slices: readonly Slice[];
  readonly sources?: readonly Source[];
}

export function validateRelationships(graph: RelationshipGraph): RelationshipValidationResult {
  const errors: string[] = [];
  const compositionIds = new Set(graph.compositions.map((item) => item.id));
  const deckIds = new Set(graph.decks.map((item) => item.id));
  const groupIds = new Set(graph.groups.map((item) => item.id));
  const layerIds = new Set(graph.layers.map((item) => item.id));
  const sliceIds = new Set(graph.slices.map((item) => item.id));
  const sourceIds = new Set((graph.sources ?? []).map((item) => item.id));

  for (const composition of graph.compositions) {
    for (const deckId of composition.deckIds) if (!deckIds.has(deckId)) errors.push(`Composition "${composition.id}" references missing deck "${deckId}".`);
    for (const groupId of composition.groupIds) if (!groupIds.has(groupId)) errors.push(`Composition "${composition.id}" references missing group "${groupId}".`);
    for (const sliceId of composition.sliceIds) if (!sliceIds.has(sliceId)) errors.push(`Composition "${composition.id}" references missing slice "${sliceId}".`);
  }

  for (const deck of graph.decks) {
    if (deck.compositionId !== undefined && !compositionIds.has(deck.compositionId)) errors.push(`Deck "${deck.id}" references missing composition "${deck.compositionId}".`);
    for (const layer of deck.layers) {
      if (!layerIds.has(layer.id)) errors.push(`Deck "${deck.id}" contains unregistered layer "${layer.id}".`);
      if (layer.sourceId != null && !sourceIds.has(layer.sourceId)) errors.push(`Layer "${layer.id}" references missing source "${layer.sourceId}".`);
      for (const sliceId of layer.sliceIds ?? []) if (!sliceIds.has(sliceId)) errors.push(`Layer "${layer.id}" references missing slice "${sliceId}".`);
    }
  }

  for (const group of graph.groups) for (const layerId of group.layerIds) if (!layerIds.has(layerId)) errors.push(`Group "${group.id}" references missing layer "${layerId}".`);
  for (const slice of graph.slices) for (const layerId of slice.layerIds) if (!layerIds.has(layerId)) errors.push(`Slice "${slice.id}" references missing layer "${layerId}".`);

  return { valid: errors.length === 0, errors };
}
