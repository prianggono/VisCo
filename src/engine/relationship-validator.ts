import type { Composition } from "../domain/composition.js";
import type { Deck } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import type { Layer } from "../domain/layer.js";
import type { Scene } from "../domain/scene.js";
import type { Slice } from "../domain/slice.js";
import type { Source } from "../domain/source.js";

export interface RelationshipValidationResult { readonly valid: boolean; readonly errors: readonly string[]; }
export interface RelationshipGraph {
  readonly compositions: readonly Composition[];
  readonly decks: readonly Deck[];
  readonly groups: readonly Group[];
  readonly layers: readonly Layer[];
  readonly slices: readonly Slice[];
  readonly sources?: readonly Source[];
  readonly scenes?: readonly Scene[];
}
export function validateRelationships(graph: RelationshipGraph): RelationshipValidationResult {
  const errors: string[] = [];
  const compositionIds = new Set(graph.compositions.map((item) => item.id));
  const deckIds = new Set(graph.decks.map((item) => item.id));
  const groupIds = new Set(graph.groups.map((item) => item.id));
  const layerIds = new Set(graph.layers.map((item) => item.id));
  const sliceIds = new Set(graph.slices.map((item) => item.id));
  const sourceIds = new Set((graph.sources ?? []).map((item) => item.id));

  const collections: readonly [string, readonly { readonly id: string }[]][] = [
    ["composition", graph.compositions],
    ["deck", graph.decks],
    ["group", graph.groups],
    ["layer", graph.layers],
    ["slice", graph.slices],
    ["source", graph.sources ?? []],
    ["scene", graph.scenes ?? []]
  ];
  for (const [label, items] of collections) {
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.id.trim()) errors.push(`${label} id cannot be empty.`);
      else if (seen.has(item.id)) errors.push(`Duplicate ${label} id "${item.id}".`);
      else seen.add(item.id);
    }
  }

  for (const composition of graph.compositions) {
    for (const deckId of composition.deckIds) if (!deckIds.has(deckId)) errors.push(`Composition "${composition.id}" references missing deck "${deckId}".`);
    for (const groupId of composition.groupIds) if (!groupIds.has(groupId)) errors.push(`Composition "${composition.id}" references missing group "${groupId}".`);
    for (const sliceId of composition.sliceIds) if (!sliceIds.has(sliceId)) errors.push(`Composition "${composition.id}" references missing slice "${sliceId}".`);
  }
  for (const deck of graph.decks) {
    for (const layer of deck.layers) {
      if (!layerIds.has(layer.id)) errors.push(`Deck "${deck.id}" contains unregistered layer "${layer.id}".`);
      if (layer.sourceId != null && !sourceIds.has(layer.sourceId)) errors.push(`Layer "${layer.id}" references missing source "${layer.sourceId}".`);
    }
  }
  for (const group of graph.groups) {
    const ownerComposition = graph.compositions.find((composition) => composition.groupIds.includes(group.id));
    for (const layerId of group.layerIds) {
      if (!layerIds.has(layerId)) {
        errors.push(`Group "${group.id}" references missing layer "${layerId}".`);
        continue;
      }
      if (ownerComposition) {
        const ownerDeck = graph.decks.find((deck) => deck.layers.some((layer) => layer.id === layerId));
        if (ownerDeck && !ownerComposition.deckIds.includes(ownerDeck.id)) {
          errors.push(`Group "${group.id}" references layer "${layerId}" outside composition "${ownerComposition.id}".`);
        }
      }
    }
  }
  for (const slice of graph.slices) {
    const ownerComposition = graph.compositions.find((composition) => composition.sliceIds.includes(slice.id));
    for (const ref of slice.layerRefs) {
      const deck = graph.decks.find((candidate) => candidate.id === ref.deckId);
      if (!deck) {
        errors.push(`Slice "${slice.id}" references missing deck "${ref.deckId}".`);
        continue;
      }
      if (!deck.layers.some((layer) => layer.id === ref.layerId)) {
        errors.push(`Slice "${slice.id}" references missing layer "${ref.layerId}" in deck "${ref.deckId}".`);
      }
      if (ownerComposition && !ownerComposition.deckIds.includes(ref.deckId)) {
        errors.push(`Slice "${slice.id}" references deck "${ref.deckId}" outside composition "${ownerComposition.id}".`);
      }
    }
  }
  for (const scene of graph.scenes ?? []) {
    if (!compositionIds.has(scene.compositionId)) errors.push(`Scene "${scene.id}" references missing composition "${scene.compositionId}".`);
    if (scene.target.kind === "display" && !scene.target.displayId.trim()) errors.push(`Scene "${scene.id}" requires a display target.`);
    if (scene.target.kind === "production" && !(scene.target.record || scene.target.stream || scene.target.virtual)) errors.push(`Production Scene "${scene.id}" must enable at least one production output.`);
    for (const sliceId of scene.sliceIds ?? []) {
      if (!sliceIds.has(sliceId)) {
        errors.push(`Scene "${scene.id}" references missing slice "${sliceId}".`);
        continue;
      }
      const ownerComposition = graph.compositions.find((composition) => composition.sliceIds.includes(sliceId));
      if (ownerComposition && ownerComposition.id !== scene.compositionId) {
        errors.push(`Scene "${scene.id}" references slice "${sliceId}" outside composition "${scene.compositionId}".`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
