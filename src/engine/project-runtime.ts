import type { Composition } from "../domain/composition.js";
import type { Deck } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import type { Layer } from "../domain/layer.js";
import type { Scene } from "../domain/scene.js";
import type { Slice } from "../domain/slice.js";
import type { Source } from "../domain/source.js";
import type { OutputTarget } from "../domain/output.js";
import { createProjectSnapshot, parseProject, serializeProject, type ProjectSnapshot, type ProjectSnapshotInput } from "./project-persistence.js";
import { validateRelationships, type RelationshipGraph } from "./relationship-validator.js";

export interface ProjectRuntimeState extends ProjectSnapshot {
  readonly dirty: boolean;
}

export function cloneProjectSnapshot(snapshot: ProjectSnapshot): ProjectSnapshot {
  return parseProject(serializeProject(snapshot));
}

export class ProjectRuntime {
  private snapshot: ProjectSnapshot;
  private dirty = false;

  constructor(initial: ProjectSnapshotInput) {
    this.snapshot = createProjectSnapshot(initial);
    this.assertValid(this.snapshot);
  }

  getState(): ProjectRuntimeState {
    return { ...this.snapshot, dirty: this.dirty };
  }

  replace(input: ProjectSnapshotInput): ProjectRuntimeState {
    const next = createProjectSnapshot(input);
    this.assertValid(next);
    this.snapshot = next;
    this.dirty = false;
    return this.getState();
  }

  markDirty(): void {
    this.dirty = true;
  }

  serialize(): string {
    return serializeProject(this.snapshot);
  }

  load(serialized: string): ProjectRuntimeState {
    const next = parseProject(serialized);
    this.assertValid(next);
    this.snapshot = next;
    this.dirty = false;
    return this.getState();
  }

  update(next: ProjectSnapshotInput): ProjectRuntimeState {
    const snapshot = createProjectSnapshot(next);
    this.assertValid(snapshot);
    this.snapshot = snapshot;
    this.dirty = true;
    return this.getState();
  }

  private assertValid(snapshot: ProjectSnapshot): void {
    const graph: RelationshipGraph = {
      compositions: snapshot.compositions,
      decks: snapshot.decks,
      groups: snapshot.groups,
      layers: snapshot.layers,
      slices: snapshot.slices,
      sources: snapshot.sources,
      scenes: snapshot.scenes
    };
    const result = validateRelationships(graph);
    if (!result.valid) throw new Error(`Invalid VisCo project: ${result.errors.join(" ")}`);
  }
}

export function projectSnapshotFromCollections(input: {
  readonly compositions: readonly Composition[];
  readonly decks: readonly Deck[];
  readonly groups: readonly Group[];
  readonly layers?: readonly Layer[];
  readonly slices: readonly Slice[];
  readonly scenes: readonly Scene[];
  readonly sources: readonly Source[];
  readonly outputs: readonly OutputTarget[];
}): ProjectSnapshot {
  const layers = input.layers ?? input.decks.flatMap((deck) => deck.layers);
  return createProjectSnapshot({
    compositions: input.compositions,
    decks: input.decks,
    groups: input.groups,
    layers,
    slices: input.slices,
    scenes: input.scenes,
    sources: input.sources,
    outputs: input.outputs
  });
}
