import { describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "../src/persistence/project.js";
import { defaultLicense } from "../src/domain/license.js";

describe("Project persistence contract", () => {
  it("keeps Deck-owned Layers out of the global snapshot registry", () => {
    const snapshot: ProjectSnapshot = {
      version: 1,
      compositions: [],
      channels: [],
      decks: [],
      groups: [],
      slices: [],
      sources: [],
      outputs: [],
      license: defaultLicense("unlicensed")
    };

    expect(snapshot.channels).toEqual([]);
    expect(snapshot.groups).toEqual([]);
    expect(snapshot.slices).toEqual([]);
    expect(snapshot.outputs).toEqual([]);
    expect(snapshot.license).toEqual({
      state: "unlicensed",
      watermarkEnabled: true
    });
  });
});
