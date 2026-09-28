import type { Composition } from "../domain/composition.js";
import type { Deck } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import type { Layer } from "../domain/layer.js";
import type { Scene } from "../domain/scene.js";
import type { Slice } from "../domain/slice.js";
import type { Source } from "../domain/source.js";
import type { OutputTarget } from "../domain/output.js";

export interface ProjectSnapshot {
  readonly version: 1;
  readonly compositions: readonly Composition[];
  readonly decks: readonly Deck[];
  readonly groups: readonly Group[];
  readonly layers: readonly Layer[];
  readonly slices: readonly Slice[];
  readonly scenes: readonly Scene[];
  readonly sources: readonly Source[];
  readonly outputs: readonly OutputTarget[];
}

export type ProjectSnapshotInput = Omit<ProjectSnapshot, "version">;

export function createProjectSnapshot(input: ProjectSnapshotInput): ProjectSnapshot {
  return {
    version: 1,
    compositions: [...input.compositions],
    decks: [...input.decks],
    groups: [...input.groups],
    layers: [...input.layers],
    slices: [...input.slices],
    scenes: [...input.scenes],
    sources: [...input.sources],
    outputs: [...input.outputs]
  };
}

export function serializeProject(snapshot: ProjectSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseProject(serialized: string): ProjectSnapshot {
  const parsed: unknown = JSON.parse(serialized);
  if (!parsed || typeof parsed !== "object" || (parsed as { version?: unknown }).version !== 1) {
    throw new Error("Unsupported VisCo project snapshot version.");
  }
  const value = parsed as Partial<ProjectSnapshot>;
  const collections: Array<keyof ProjectSnapshot> = ["compositions", "decks", "groups", "layers", "slices", "scenes", "sources", "outputs"];
  for (const key of collections) {
    if (!Array.isArray(value[key])) throw new Error(`Invalid VisCo project snapshot: "${key}" must be an array.`);
  }
  return parsed as ProjectSnapshot;
}
