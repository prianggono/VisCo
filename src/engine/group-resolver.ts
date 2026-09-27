import type { Deck, DeckLayerRef, Layer } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import { getDeckLayer } from "../domain/deck.js";

export interface ResolvedGroupLayer {
  readonly ref: DeckLayerRef;
  readonly layer: Layer;
}

/**
 * Resolves a Group into its ordered runtime Layer references.
 *
 * Group.layerIds define the formasi/slot order for activation. Layer.order
 * remains the Deck-level render stacking order and is not modified here.
 */
export function resolveGroupLayers(deck: Deck, group: Group): readonly ResolvedGroupLayer[] {
  if (group.deckId !== deck.id) {
    throw new Error(`Group "${group.id}" belongs to deck "${group.deckId}", not "${deck.id}".`);
  }

  const seen = new Set<string>();

  return group.layerIds.map((layerId) => {
    if (seen.has(layerId)) {
      throw new Error(`Group "${group.id}" contains duplicate layer "${layerId}".`);
    }
    seen.add(layerId);

    const layer = getDeckLayer(deck, { deckId: deck.id, layerId });
    return {
      ref: { deckId: deck.id, layerId: layer.id },
      layer
    };
  });
}
