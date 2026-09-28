import type { ProjectSnapshot, RevisionSnapshot } from "../persistence/project.js";
import { validateRelationships, type RelationshipValidationResult } from "./relationship-validator.js";

export class ProjectPersistenceError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Project validation failed: ${errors.join(" ")}`);
    this.name = "ProjectPersistenceError";
    this.errors = errors;
  }
}

export interface RevisionIdFactory {
  nextRevisionId(): string;
}

function validateProject(project: ProjectSnapshot): RelationshipValidationResult {
  return validateRelationships({
    compositions: project.compositions,
    channels: project.channels,
    decks: project.decks,
    groups: project.groups,
    slices: project.slices,
    sources: project.sources,
    library: project.library,
    outputs: project.outputs
  });
}

function assertValidProject(project: ProjectSnapshot): ProjectSnapshot {
  const result = validateProject(project);
  if (!result.valid) {
    throw new ProjectPersistenceError(result.errors);
  }
  return project;
}

export function validateProjectSnapshot(project: ProjectSnapshot): RelationshipValidationResult {
  return validateProject(project);
}

/**
 * Canonical persistence boundary.
 * Runtime engines are deliberately absent: Program, Preview, playback, render
 * plans and output runtime state are never serialized by this API.
 */
export function serializeProject(project: ProjectSnapshot): string {
  assertValidProject(project);
  return JSON.stringify(project);
}

export function deserializeProject(serialized: string): ProjectSnapshot {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new ProjectPersistenceError(["Project data is not valid JSON."]);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ProjectPersistenceError(["Project data must be a JSON object."]);
  }

  const project = parsed as Partial<ProjectSnapshot>;
  if (typeof project.version !== "number" || !Number.isInteger(project.version) || project.version < 1) {
    throw new ProjectPersistenceError(["Project version must be a positive integer."]);
  }

  if (!Array.isArray(project.compositions) ||
      !Array.isArray(project.channels) ||
      !Array.isArray(project.decks) ||
      !Array.isArray(project.groups) ||
      !Array.isArray(project.slices) ||
      !Array.isArray(project.sources) ||
      !Array.isArray(project.outputs) ||
      !project.license ||
      typeof project.license !== "object") {
    throw new ProjectPersistenceError(["Project snapshot is missing required collections or license state."]);
  }

  assertValidProject(project as ProjectSnapshot);
  return project as ProjectSnapshot;
}

export function createRevision(
  project: ProjectSnapshot,
  createdAt: string,
  idFactory: RevisionIdFactory
): RevisionSnapshot {
  assertValidProject(project);

  if (!createdAt || Number.isNaN(Date.parse(createdAt))) {
    throw new ProjectPersistenceError(["Revision createdAt must be a valid ISO date string."]);
  }

  const id = idFactory.nextRevisionId();
  if (!id) {
    throw new ProjectPersistenceError(["Revision ID cannot be empty."]);
  }

  return {
    id,
    createdAt,
    project
  };
}

export function serializeRevision(revision: RevisionSnapshot): string {
  assertValidProject(revision.project);

  if (!revision.id || !revision.createdAt || Number.isNaN(Date.parse(revision.createdAt))) {
    throw new ProjectPersistenceError(["Revision metadata is invalid."]);
  }

  return JSON.stringify(revision);
}
