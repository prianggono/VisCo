import type { ProjectSnapshot } from "../persistence/project.js";
import type { Deck } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import { cloneDeck, type CloneIdFactory } from "./deck-cloner.js";

export interface CloneDeckInProjectOptions {
  readonly id: string;
  readonly name?: string;
  readonly idFactory: CloneIdFactory;
}

export interface CloneDeckInProjectResult {
  readonly project: ProjectSnapshot;
  readonly deck: Deck;
  readonly groups: readonly Group[];
}

/**
 * Adds a cloned Deck and its owned Groups to a ProjectSnapshot.
 *
 * Deliberately does not attach the clone to Composition, Channel, Output,
 * Program or Preview state. Those are explicit presentation/runtime decisions.
 */
export function cloneDeckInProject(
  project: ProjectSnapshot,
  sourceDeckId: string,
  options: CloneDeckInProjectOptions
): CloneDeckInProjectResult {
  const sourceDeck = project.decks.find((deck) => deck.id === sourceDeckId);
  if (!sourceDeck) {
    throw new Error(`Deck "${sourceDeckId}" does not exist in the project.`);
  }

  if (project.decks.some((deck) => deck.id === options.id)) {
    throw new Error(`Deck "${options.id}" already exists in the project.`);
  }

  const { deck, groups } = cloneDeck(sourceDeck, project.groups, options);

  const existingGroupIds = new Set(project.groups.map((group) => group.id));
  for (const group of groups) {
    if (existingGroupIds.has(group.id)) {
      throw new Error(`Group "${group.id}" already exists in the project.`);
    }
  }

  return {
    project: {
      ...project,
      decks: [...project.decks, deck],
      groups: [...project.groups, ...groups]
    },
    deck,
    groups
  };
}
