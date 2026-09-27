import type { Channel } from "../domain/channel.js";
import type { ProjectSnapshot } from "../persistence/project.js";

export interface DetachDeckFromChannelOptions {
  readonly channelId: string;
  readonly deckId: string;
}

export interface DetachDeckFromChannelResult {
  readonly project: ProjectSnapshot;
  readonly channel: Channel;
}

/**
 * Explicitly detaches a Deck from a Channel.
 *
 * This only changes Channel membership. Composition, Slice, Output,
 * Program, Preview, and runtime state remain untouched.
 */
export function detachDeckFromChannel(
  project: ProjectSnapshot,
  options: DetachDeckFromChannelOptions
): DetachDeckFromChannelResult {
  const channelIndex = project.channels.findIndex(
    (channel) => channel.id === options.channelId
  );
  if (channelIndex < 0) {
    throw new Error(
      `Channel "${options.channelId}" does not exist in the project.`
    );
  }

  const channel = project.channels[channelIndex];

  if (!channel.deckIds.includes(options.deckId)) {
    throw new Error(
      `Deck "${options.deckId}" is not attached to Channel "${options.channelId}".`
    );
  }

  const updatedChannel: Channel = {
    ...channel,
    deckIds: channel.deckIds.filter((deckId) => deckId !== options.deckId)
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
