import { describe, expect, it } from "vitest";
import { renderCompositionTransition, type RenderedCompositionLayer } from "../src/engine/composition-renderer.js";

const plan = (layerId: string, opacity = 100): RenderedCompositionLayer => ({
  sliceId: "slice-1",
  ref: { deckId: "deck-1", layerId },
  layerId,
  layerStyle: {
    transform: "translate(-50%, -50%) translate(0px, 0px) rotate(0deg) scale(1, 1)",
    opacity,
    transformOrigin: "center center",
    zIndex: 1,
    mixBlendMode: "normal"
  },
  sliceStyle: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 }
});

describe("Composition transition renderer", () => {
  const previous = [plan("old", 1)];
  const current = [plan("new", 1)];

  it("cuts directly to the current plan", () => {
    const result = renderCompositionTransition(previous, current, {
      active: true,
      progress: 0.25,
      from: { deckId: "deck-1", layerId: "old" },
      to: { deckId: "deck-1", layerId: "new" },
      transition: { type: "cut", durationMs: 0 }
    });

    expect(result.layers).toEqual(current);
    expect(result.active).toBe(false);
  });

  it("crossfades previous and current plans", () => {
    const result = renderCompositionTransition(previous, current, {
      active: true,
      progress: 0.25,
      from: { deckId: "deck-1", layerId: "old" },
      to: { deckId: "deck-1", layerId: "new" },
      transition: { type: "fade", durationMs: 400 }
    });

    expect(result.layers).toHaveLength(2);
    expect(result.layers[0]?.layerStyle.opacity).toBe(0.75);
    expect(result.layers[1]?.layerStyle.opacity).toBe(0.25);
    expect(result.active).toBe(true);
  });

  it("wipes the current plan from left to right", () => {
    const result = renderCompositionTransition(previous, current, {
      active: true,
      progress: 0.25,
      from: { deckId: "deck-1", layerId: "old" },
      to: { deckId: "deck-1", layerId: "new" },
      transition: { type: "wipe", durationMs: 400 }
    });

    expect(result.layers).toHaveLength(2);
    expect(result.layers[0]).toEqual(previous[0]);
    expect(result.layers[1]?.layerStyle.clipPath).toBe("inset(0 75% 0 0)");
    expect(result.active).toBe(true);
  });

  it("uses the current plan when the transition has completed", () => {
    const result = renderCompositionTransition(previous, current, {
      active: false,
      progress: 1,
      from: { deckId: "deck-1", layerId: "old" },
      to: { deckId: "deck-1", layerId: "new" },
      transition: { type: "fade", durationMs: 400 }
    });

    expect(result.layers).toEqual(current);
    expect(result.active).toBe(false);
  });
});
