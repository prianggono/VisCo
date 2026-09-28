import { describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "../src/persistence/project.js";
import { defaultLicense } from "../src/domain/license.js";
import {
  createRevision,
  deserializeProject,
  ProjectPersistenceError,
  serializeProject,
  serializeRevision,
  validateProjectSnapshot
} from "../src/engine/project-persistence.js";

const project: ProjectSnapshot = {
  version: 1,
  compositions: [{
    id: "comp-1",
    name: "Venue",
    format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 },
    deckIds: ["deck-1"],
    sliceIds: ["slice-1"],
    locked: false
  }],
  channels: [{
    id: "offline",
    name: "Offline",
    type: "offline",
    deckIds: ["deck-1"],
    enabled: true
  }],
  decks: [{
    id: "deck-1",
    name: "Deck 1",
    layers: [{ id: "layer-1", name: "Opening", sourceId: "src-1" }],
    transition: { type: "fade", durationMs: 500 }
  }],
  groups: [],
  slices: [{
    id: "slice-1",
    name: "Main",
    transform: { x: 960, y: 540, width: 1920, height: 1080, rotation: 0 },
    layerRefs: [{ deckId: "deck-1", layerId: "layer-1" }],
    locked: false
  }],
  sources: [{ id: "src-1", name: "Opening", kind: "video" }],
  library: { sourceIds: ["src-1"] },
  outputs: [{
    id: "display-1",
    kind: "display",
    enabled: true,
    compositionId: "comp-1",
    deckId: "deck-1"
  }],
  license: defaultLicense("unlicensed")
};

describe("Project persistence boundary", () => {
  it("validates, serializes and restores a canonical snapshot", () => {
    expect(validateProjectSnapshot(project)).toEqual({ valid: true, errors: [] });

    const restored = deserializeProject(serializeProject(project));
    expect(restored).toEqual(project);
  });

  it("rejects broken Source/Library relationships before serialization", () => {
    const broken = {
      ...project,
      library: { sourceIds: ["missing-source"] }
    };

    expect(() => serializeProject(broken)).toThrow(ProjectPersistenceError);
    expect(() => serializeProject(broken)).toThrow('Library references missing Source "missing-source".');
  });

  it("rejects an Output whose Deck is outside its Composition", () => {
    const broken = {
      ...project,
      outputs: [{
        ...project.outputs[0],
        deckId: "deck-2"
      }]
    };

    expect(() => serializeProject(broken)).toThrow(
      'Output "display-1" targets Deck "deck-2", but that Deck is not attached to Composition "comp-1".'
    );
  });

  it("rejects broken Output references before serialization", () => {
    const broken = {
      ...project,
      outputs: [{
        ...project.outputs[0],
        compositionId: "missing-composition"
      }]
    };

    expect(() => serializeProject(broken)).toThrow(
      'Output "display-1" references missing Composition "missing-composition".'
    );
  });

  it("rejects invalid JSON and malformed snapshots on restore", () => {
    expect(() => deserializeProject("{broken")).toThrow(ProjectPersistenceError);
    expect(() => deserializeProject(JSON.stringify({ version: 1 }))).toThrow(
      "Project snapshot is missing required collections or license state."
    );
  });

  it("creates a validated revision without runtime state", () => {
    const revision = createRevision(project, "2026-09-28T03:30:00.000Z", {
      nextRevisionId: () => "rev-1"
    });

    expect(revision.id).toBe("rev-1");
    expect(revision.project).toEqual(project);
    expect(serializeRevision(revision)).toContain('"version":1');
    expect(serializeRevision(revision)).not.toContain("activeLayerId");
    expect(serializeRevision(revision)).not.toContain("previewLayerId");
    expect(serializeRevision(revision)).not.toContain("renderPlan");
  });

  it("rejects invalid revision metadata", () => {
    expect(() =>
      createRevision(project, "not-a-date", { nextRevisionId: () => "rev-1" })
    ).toThrow("Revision createdAt must be a valid ISO date string.");
  });
});
