export type ChannelType = "offline" | "online";

export interface Channel {
  readonly id: string;
  readonly name: string;
  readonly type: ChannelType;
  /** Decks assigned to this presentation flow. A Deck may be reused by multiple channels. */
  readonly deckIds: readonly string[];
  readonly enabled: boolean;
}
