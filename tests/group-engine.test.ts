import { describe, expect, it } from "vitest";
import { GroupEngine } from "../src/engine/group-engine.js";

describe("GroupEngine", () => {
  it("creates, collapses, assigns, clones and persists groups", () => {
    const engine = new GroupEngine();
    const group = engine.create("g1", "Main", ["l1", "l1"]);
    expect(group.layerIds).toEqual(["l1"]);
    engine.addLayer("g1", "l2");
    expect(engine.toggleCollapsed("g1").collapsed).toBe(true);
    const clone = engine.clone("g1", "g2");
    expect(clone.layerIds).toEqual(["l1", "l2"]);
    engine.replaceAll(engine.list());
    expect(engine.list()).toHaveLength(2);
  });
});
