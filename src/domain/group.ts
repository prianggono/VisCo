export interface Group {
  readonly id: string;
  readonly name: string;
  /** Group belongs to exactly one Deck. */
  readonly deckId: string;
  /** Layer IDs are resolved within the owning Deck. */
  readonly layerIds: readonly string[];
  readonly collapsed: boolean;
}
