import { describe, expect, it } from "vitest";
import type { Deck } from "../src/domain/deck.js";
import { ProgramEngine } from "../src/engine/program-engine.js";

const deck: Deck = {
  id: "deck-1",
  name: "Deck 1",
  layers: [
    { id: "camera-left", name: "Camera Kiri" },
    { id: "ppt", name: "PPT" },
    { id: "camera-right", name: "Camera Kanan" }
  ],
  transition: { type: "fade", durationMs: 300 }
};

describe("ProgramEngine", () => {
  it("starts with an empty multi-layer Program", () => {
    const engine = new ProgramEngine();
    expect(engine.getState()).toEqual({
      compositionId: "default",
      layers: [],
      source: null,
      layer: null,
      transition: null
    });
  });

  it("programs multiple Layers in the requested formasi order", () => {
    const engine = new ProgramEngine();

    const state = engine.programLayers(
      deck,
      ["camera-left", "ppt", "camera-right"],
      "composition-1"
    );

    expect(state.compositionId).toBe("composition-1");
    expect(state.layers.map((item) => item.source)).toEqual([
      { deckId: "deck-1", layerId: "camera-left" },
      { deckId: "deck-1", layerId: "ppt" },
      { deckId: "deck-1", layerId: "camera-right" }
    ]);
    expect(state.layers.map((item) => item.layer.id)).toEqual([
      "camera-left", "ppt", "camera-right"
    ]);
    expect(state.source).toEqual({ deckId: "deck-1", layerId: "camera-left" });
    expect(state.layer?.id).toBe("camera-left");
    expect(state.transition).toEqual({ type: "fade", durationMs: 300 });
  });

  it("keeps Program state isolated between Compositions", () => {
    const engine = new ProgramEngine();

    engine.program(deck, "camera-left", "offline");
    engine.program(deck, "ppt", "online");

    expect(engine.getState("offline").source).toEqual({
      deckId: "deck-1",
      layerId: "camera-left"
    });
    expect(engine.getState("online").source).toEqual({
      deckId: "deck-1",
      layerId: "ppt"
    });
  });

  it("replaces the previous Program formasi completely within one Composition", () => {
    const engine = new ProgramEngine();

    engine.programLayers(deck, ["camera-left", "ppt"], "offline");
    const next = engine.program(deck, "camera-right", "offline");

    expect(next.layers.map(({ source }) => source)).toEqual([
      { deckId: "deck-1", layerId: "camera-right" }
    ]);
    expect(engine.getState("offline").layers).toHaveLength(1);
    expect(engine.getState("offline").source).toEqual({
      deckId: "deck-1",
      layerId: "camera-right"
    });
  });

  it("returns an empty state for an unknown Composition without affecting existing state", () => {
    const engine = new ProgramEngine();

    engine.program(deck, "ppt", "offline");

    expect(engine.getState("unknown")).toEqual({
      compositionId: "unknown",
      layers: [],
      source: null,
      layer: null,
      transition: null
    });
    expect(engine.getState("offline").source).toEqual({
      deckId: "deck-1",
      layerId: "ppt"
    });
  });

  it("keeps single-Layer programming compatible", () => {
    const engine = new ProgramEngine();

    const state = engine.program(deck, "ppt");

    expect(state.layers).toHaveLength(1);
    expect(state.source).toEqual({ deckId: "deck-1", layerId: "ppt" });
    expect(state.layer?.id).toBe("ppt");
  });

  it("rejects duplicate Layers in one Program formasi", () => {
    const engine = new ProgramEngine();

    expect(() => engine.programLayers(deck, ["ppt", "ppt"])).toThrow(
      'Layer "ppt" is duplicated in Program formasi.'
    );
  });

  it("keeps M gating and validates Layer membership", () => {
    const engine = new ProgramEngine();

    expect(() => engine.programLayers(
      { ...deck, masterLevel: 0 },
      ["ppt"]
    )).toThrow('Deck "deck-1" is muted by M and cannot enter Program.');

    expect(() => engine.programLayers(deck, ["missing"])).toThrow(
      'Layer "missing" does not exist in deck "deck-1".'
    );
  });
});
