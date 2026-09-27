import type { ProjectSnapshot } from "../persistence/project.js";
import type { Group } from "../domain/group.js";
import { cloneGroup } from "./deck-cloner.js";

export interface CloneGroupInProjectOptions {
  readonly id: string;
  readonly name?: string;
  readonly deckId?: string;
}

export interface CloneGroupInProjectResult {
  readonly project: ProjectSnapshot;
  readonly group: Group;
}

/**
 * Adds a cloned Group to a ProjectSnapshot.
 *
 * By default the clone remains in the source Group's Deck. A different Deck
 * may be supplied explicitly, but the target Deck must exist. No Layer or
 * Source objects are duplicated.
 */
export function cloneGroupInProject(
  project: ProjectSnapshot,
  sourceGroupId: string,
  options: CloneGroupInProjectOptions
): CloneGroupInProjectResult {
  const sourceGroup = project.groups.find((group) => group.id === sourceGroupId);
  if (!sourceGroup) {
    throw new Error(`Group "${sourceGroupId}" does not exist in the project.`);
  }

  if (project.groups.some((group) => group.id === options.id)) {
    throw new Error(`Group "${options.id}" already exists in the project.`);
  }

  const targetDeckId = options.deckId ?? sourceGroup.deckId;
  if (!project.decks.some((deck) => deck.id === targetDeckId)) {
    throw new Error(`Deck "${targetDeckId}" does not exist in the project.`);
  }

  const group = cloneGroup(sourceGroup, {
    id: options.id,
    name: options.name,
    deckId: targetDeckId
  });

  return {
    project: {
      ...project,
      groups: [...project.groups, group]
    },
    group
  };
}
