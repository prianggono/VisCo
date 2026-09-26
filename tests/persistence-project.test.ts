import { describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "../src/persistence/project.js";
import { defaultLicense } from "../src/domain/license.js";

describe("Project persistence contract", () => {
  it("requires Output and License configuration in every project snapshot", () => {
    const snapshot: ProjectSnapshot = {
      version: 1,
      compositions: [],
      decks: [],
      groups: [],
      layers: [],
      slices: [],
      sources: [],
      outputs: [],
      license: defaultLicense("unlicensed")
    };

    expect(snapshot.outputs).toEqual([]);
    expect(snapshot.license).toEqual({
      state: "unlicensed",
      watermarkEnabled: true
    });
  });
});
