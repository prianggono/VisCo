import { describe, expect, it } from "vitest";
import { SceneRuntime } from "../src/engine/scene-runtime.js";
import { validateRelationships } from "../src/engine/relationship-validator.js";

const baseScene = {
  id: "scene-1",
  name: "Display 1",
  compositionId: "comp-1",
  target: { kind: "display" as const, displayId: "display-1" },
  enabled: true
};

describe("scene runtime", () => {
  it("keeps one active scene per composition", () => {
    const runtime = new SceneRuntime();
    runtime.register(baseScene);
    runtime.register({ ...baseScene, id: "scene-2", name: "Display 2", target: { kind: "display", displayId: "display-2" } });
    runtime.activate("scene-1");
    runtime.activate("scene-2");
    expect(runtime.getActive("comp-1")?.id).toBe("scene-2");
  });

  it("preserves the active scene when an active scene is updated", () => {
    const runtime = new SceneRuntime();
    runtime.register(baseScene);
    runtime.activate("scene-1");
    runtime.update({ ...baseScene, name: "Display 1 Renamed" });
    expect(runtime.getActive("comp-1")?.id).toBe("scene-1");
    expect(runtime.getActive("comp-1")?.name).toBe("Display 1 Renamed");
  });

  it("rejects empty production scenes", () => {
    const runtime = new SceneRuntime();
    expect(() => runtime.register({
      ...baseScene,
      id: "production",
      name: "Production",
      target: { kind: "production", record: false, stream: false, virtual: false }
    })).toThrow(/at least one/);
  });

  it("validates scene composition references", () => {
    const result = validateRelationships({
      compositions: [],
      decks: [],
      groups: [],
      layers: [],
      slices: [],
      scenes: [baseScene]
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("missing composition");
  });
});
