import type { Composition } from "../domain/composition.js";
import type { Deck } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import type { Layer } from "../domain/layer.js";
import type { Slice } from "../domain/slice.js";
import type { Source } from "../domain/source.js";

export interface ProjectSnapshot {
  readonly version: number;
  readonly compositions: readonly Composition[];
  readonly decks: readonly Deck[];
  readonly groups: readonly Group[];
  readonly layers: readonly Layer[];
  readonly slices: readonly Slice[];
  readonly sources: readonly Source[];
}

export interface RevisionSnapshot {
  readonly id: string;
  readonly createdAt: string;
  readonly project: ProjectSnapshot;
}
