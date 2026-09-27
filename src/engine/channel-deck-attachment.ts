import type { Channel } from "../domain/channel.js";
import type { ProjectSnapshot } from "../persistence/project.js";

export interface AttachDeckToChannelOptions {
  readonly channelId: string;
  readonly deckId: string;
  readonly index?: number;
}

export interface AttachDeckToChannelResult {
  readonly project: ProjectSnapshot;
  readonly channel: Channel;
}

/**
 * Explicitly attaches an existing Deck to an existing Channel.
 *
 * Channel membership is presentation-flow configuration. It does not
 * modify Composition, Slice, Output, Program, Preview, or runtime state.
 */
export function attachDeckToChannel(
  project: ProjectSnapshot,
  options: AttachDeckToChannelOptions
): AttachDeckToChannelResult {
  const channelIndex = project.channels.findIndex(
    (channel) => channel.id === options.channelId
  );
  if (channelIndex < 0) {
    throw new Error(
      `Channel "${options.channelId}" does not exist in the project.`
    );
  }

  if (!project.decks.some((deck) => deck.id === options.deckId)) {
    throw new Error(
      `Deck "${options.deckId}" does not exist in the project.`
    );
  }

  const channel = project.channels[channelIndex];

  if (channel.deckIds.includes(options.deckId)) {
    throw new Error(
      `Deck "${options.deckId}" is already attached to Channel "${options.channelId}".`
    );
  }

  const deckIds = [...channel.deckIds];

  if (options.index === undefined) {
    deckIds.push(options.deckId);
  } else {
    if (
      !Number.isInteger(options.index) ||
      options.index < 0 ||
      options.index > deckIds.length
    ) {
      throw new Error(
        `Deck attachment index ${options.index} is out of range for Channel "${options.channelId}".`
      );
    }
    deckIds.splice(options.index, 0, options.deckId);
  }

  const updatedChannel: Channel = {
    ...channel,
    deckIds
  };

  const channels = project.channels.map((candidate, index) =>
    index === channelIndex ? updatedChannel : candidate
  );

  return {
    project: {
      ...project,
      channels
    },
    channel: updatedChannel
  };
}
