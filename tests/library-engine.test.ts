import { describe, expect, it } from "vitest";
import { LibraryEngine } from "../src/engine/library-engine.js";

describe("LibraryEngine", () => {
  it("keeps one canonical reusable Source registry", () => {
    const library = new LibraryEngine();
    library.add({ id: "src-1", name: "Intro.mp4", kind: "video", uri: "file:///Intro.mp4" });

    expect(library.get("src-1").name).toBe("Intro.mp4");
    expect(library.snapshot()).toEqual({ sourceIds: ["src-1"] });
    expect(library.list("video")).toHaveLength(1);
  });

  it("rejects duplicate source ids", () => {
    const library = new LibraryEngine([{ id: "src-1", name: "Intro", kind: "video" }]);
    expect(() => library.add({ id: "src-1", name: "Other", kind: "video" })).toThrow(/already registered/);
  });

  it("allows updating metadata without changing identity", () => {
    const library = new LibraryEngine([{ id: "src-1", name: "Intro", kind: "video" }]);
    library.update({ id: "src-1", name: "Intro Updated", kind: "video" });
    expect(library.get("src-1").name).toBe("Intro Updated");
  });
});
