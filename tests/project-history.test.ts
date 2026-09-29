import { describe, expect, it } from "vitest";
import { ProjectHistory } from "../src/engine/project-history.js";
describe("ProjectHistory", () => {
  it("supports bounded undo/redo", () => {
    const h = new ProjectHistory(0, { maxEntries: 3 });
    h.push(1); h.push(2); h.push(3); h.push(4);
    expect(h.undo()).toBe(3);
    expect(h.undo()).toBe(2);
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBe(3);
  });
});
