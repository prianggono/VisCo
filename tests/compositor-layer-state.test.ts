import { describe, expect, it } from "vitest";
import { compositeLayersForRender } from "../src/engine/compositor.js";

const layer = (id: string, patch: Record<string, unknown> = {}) => ({
  id, name: id, sourceId: null, order: 0,
  ...patch
}) as never;

describe("compositor layer operator state", () => {
  it("excludes invisible layers", () => {
    expect(compositeLayersForRender([layer("a", { visible: false }), layer("b")]).map((x) => x.layerId)).toEqual(["b"]);
  });
  it("renders only solo layers when any solo layer exists", () => {
    expect(compositeLayersForRender([layer("a"), layer("b", { solo: true }), layer("c", { solo: true })]).map((x) => x.layerId)).toEqual(["b", "c"]);
  });
});
