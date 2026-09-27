import { describe, expect, it } from "vitest";
import type { LayerTransform } from "../src/domain/layer.js";
import {
  getLayerScaleFactors,
  patchLayerTransform,
  resolveLayerTransform,
  setLayerScale
} from "../src/engine/layer-transform.js";
import { getLayerRenderStyle } from "../src/engine/layer-renderer.js";
import { compositeLayer } from "../src/engine/compositor.js";

const base: LayerTransform = resolveLayerTransform();

describe("Layer Transform", () => {
  it("updates position axes independently", () => {
    const x = patchLayerTransform(base, { x: 120 });
    expect(x.x).toBe(120);
    expect(x.y).toBe(0);
    expect(x.rotation).toBe(0);
    expect(x.opacity).toBe(100);

    const y = patchLayerTransform(x, { y: 80 });
    expect(y.x).toBe(120);
    expect(y.y).toBe(80);
  });

  it("updates rotation independently", () => {
    const result = patchLayerTransform(base, { rotation: 25 });
    expect(result.rotation).toBe(25);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.opacity).toBe(100);
  });

  it("keeps scale axes independent when linking is off", () => {
    const current = patchLayerTransform(base, { scaleLinked: false });
    const result = setLayerScale(current, "scaleX", 150);

    expect(result.scaleX).toBe(150);
    expect(result.scaleY).toBe(100);
  });

  it("keeps scale proportional when linking is on", () => {
    const current = patchLayerTransform(base, { scaleX: 100, scaleY: 50, scaleLinked: true });
    const result = setLayerScale(current, "scaleX", 200);

    expect(result.scaleX).toBe(200);
    expect(result.scaleY).toBe(100);
  });

  it("clamps DeckRuntime master level and keeps ownership in runtime", async () => {
    const { DeckRuntime } = await import("../src/engine/deck-runtime.js");
    const deck = {
      id: "deck-runtime-test",
      name: "Runtime Test",
      transition: { type: "cut", durationMs: 0 },
      layers: [{ id: "layer-1", name: "Layer 1" }]
    };
    const runtime = new DeckRuntime();
    runtime.register(deck);
    expect(runtime.setMasterLevel(deck.id, 40).masterLevel).toBe(40);
    expect(runtime.setMasterLevel(deck.id, 140).masterLevel).toBe(100);
    expect(runtime.setMasterLevel(deck.id, -10).masterLevel).toBe(0);
  });

  it("converts percentage scale to renderer factors", () => {
    const result = getLayerScaleFactors({ ...base, scaleX: 150, scaleY: 75 });
    expect(result).toEqual({ x: 1.5, y: 0.75 });
  });

  it("renders all transform components from the same Layer state", () => {
    const layer = {
      id: "layer-test",
      name: "Test",
      transform: {
        ...base,
        x: 20,
        y: 30,
        scaleX: 125,
        scaleY: 80,
        rotation: 15,
        opacity: 60
      }
    };

    const style = getLayerRenderStyle(layer);
    expect(style.transform).toContain("translate(-50%, -50%)");
    expect(style.transform).toContain("translate(20px, 30px)");
    expect(style.transform).toContain("rotate(15deg)");
    expect(style.transform).toContain("scale(1.25, 0.8)");
    expect(style.opacity).toBe(0.6);
    expect(style.zIndex).toBe(0);
    expect(style.mixBlendMode).toBe("normal");

    const layered = {
      ...layer,
      order: 4,
      blendMode: "screen"
    };
    const layeredStyle = getLayerRenderStyle(layered);
    expect(layeredStyle.zIndex).toBe(4);
    expect(layeredStyle.mixBlendMode).toBe("screen");

    const composited = compositeLayer(layered);
    expect(composited.layerId).toBe("layer-test");
    expect(composited.style).toEqual(layeredStyle);
  });
});
