import { describe, expect, it, vi } from "vitest";
import { AutosaveController } from "../src/engine/autosave.js";
describe("AutosaveController", () => {
  it("flushes only when dirty", async () => {
    const save=vi.fn();
    const a=new AutosaveController({save},1000);
    await a.flush(1); expect(save).not.toHaveBeenCalled();
    a.markDirty(2); await a.flush(); expect(save).toHaveBeenCalledWith(2);
  });
});
