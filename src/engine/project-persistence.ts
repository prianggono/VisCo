export interface ProjectSnapshot {
  readonly version: 1;
  readonly compositions: readonly unknown[];
  readonly decks: readonly unknown[];
  readonly groups: readonly unknown[];
  readonly layers: readonly unknown[];
  readonly slices: readonly unknown[];
  readonly scenes: readonly unknown[];
  readonly sources: readonly unknown[];
  readonly outputs: readonly unknown[];
}

export function createProjectSnapshot(input: Omit<ProjectSnapshot, "version">): ProjectSnapshot {
  return { version: 1, ...input };
}

export function serializeProject(snapshot: ProjectSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseProject(serialized: string): ProjectSnapshot {
  const parsed: unknown = JSON.parse(serialized);
  if (!parsed || typeof parsed !== "object" || (parsed as { version?: unknown }).version !== 1) {
    throw new Error("Unsupported VisCo project snapshot version.");
  }
  return parsed as ProjectSnapshot;
}
