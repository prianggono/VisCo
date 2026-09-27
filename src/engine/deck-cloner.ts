import type { Deck } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import type { Layer } from "../domain/layer.js";

export interface CloneIdFactory {
  nextDeckId(source: Deck): string;
  nextGroupId(source: Group, targetDeckId: string): string;
}

export interface CloneGroupOptions {
  readonly id: string;
  readonly name?: string;
}

export interface CloneDeckOptions {
  readonly id: string;
  readonly name?: string;
  readonly idFactory: CloneIdFactory;
}

export interface CloneDeckResult {
  readonly deck: Deck;
  readonly groups: readonly Group[];
}

/**
 * Clone a Group without cloning Sources or runtime state.
 * The clone remains owned by the same Deck.
 */
export function cloneGroup(group: Group, options: CloneGroupOptions): Group {
  return {
    ...group,
    id: options.id,
    name: options.name ?? group.name,
    deckId: group.deckId,
    layerIds: [...group.layerIds]
  };
}

/**
 * Clone a Deck as editable configuration.
 *
 * Sources remain canonical and are referenced by the cloned Layers.
 * Runtime state, Program/Preview/ON AIR state and Output state are not part
 * of the Deck domain model and therefore are intentionally not cloned.
 *
 * Slice mappings are Composition-owned and are therefore never cloned with a Deck.
 * A Composition can explicitly map the clone later.
 */
export function cloneDeck(
  deck: Deck,
  groups: readonly Group[],
  options: CloneDeckOptions
): CloneDeckResult {
  const targetDeckId = options.id;
  const sourceGroupIds = new Set(deck.groupIds ?? []);
  const sourceGroups = groups.filter((group) => sourceGroupIds.has(group.id));

  const clonedGroups = sourceGroups.map((group) =>
    cloneGroup(group, {
      id: options.idFactory.nextGroupId(group, targetDeckId),
      deckId: targetDeckId
    })
  );

  const clonedDeck: Deck = {
    ...deck,
    id: targetDeckId,
    name: options.name ?? deck.name,
    layers: deck.layers.map((layer: Layer) => ({
      ...layer,
      transform: layer.transform ? { ...layer.transform } : undefined,
      playback: layer.playback ? { ...layer.playback } : undefined
    })),
    groupIds: clonedGroups.map((group) => group.id),
    transition: { ...deck.transition }
  };

  return {
    deck: clonedDeck,
    groups: clonedGroups
  };
}
