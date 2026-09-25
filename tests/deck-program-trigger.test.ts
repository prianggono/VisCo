import { describe, expect, it } from "vitest";
import type { Deck } from "../src/domain/deck.js";
import { ProgramEngine } from "../src/engine/program-engine.js";
import { TriggerEngine } from "../src/engine/trigger-engine.js";
import { OutputEngine } from "../src/engine/output-engine.js";

const deck1: Deck = {
  id: "deck-1",
  name: "Deck 1",
  layers: [
    { id: "layer-1", name: "Layer 1" },
    { id: "layer-2", name: "Layer 2" }
  ],
  transition: { type: "fade", durationMs: 500 }
};

const deck3: Deck = {
  id: "deck-3",
  name: "Deck 3",
  layers: [
    { id: "layer-1", name: "Layer 1" },
    { id: "layer-2", name: "Layer 2" }
  ],
  transition: { type: "wipe", durationMs: 300 }
};

describe("Deck -> Layer -> Program -> Trigger", () => {
  it("sends Deck 1 / Layer 2 to Program using Deck 1 transition", () => {
    const program = new ProgramEngine();
    const state = program.take(deck1, "layer-2");

    expect(state.source).toEqual({ deckId: "deck-1", layerId: "layer-2" });
    expect(state.layer?.id).toBe("layer-2");
    expect(state.transition).toEqual({ type: "fade", durationMs: 500 });
  });

  it("trigger can call Deck 3 / Layer 2 and Program uses Deck 3 transition", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const decks = new Map([
      [deck1.id, deck1],
      [deck3.id, deck3]
    ]);

    program.take(deck1, "layer-2");

    const state = trigger.execute(
      {
        type: "take",
        target: { deckId: "deck-3", layerId: "layer-2" }
      },
      { decks, program }
    );

    expect(state.source).toEqual({ deckId: "deck-3", layerId: "layer-2" });
    expect(state.layer?.id).toBe("layer-2");
    expect(state.transition).toEqual({ type: "wipe", durationMs: 300 });
  });

  it("does not store transition on a trigger action", () => {
    const action = {
      type: "take" as const,
      target: { deckId: "deck-3", layerId: "layer-2" }
    };

    expect(action).not.toHaveProperty("transition");
  });

  it("syncs Program and Deck-routed outputs from one Trigger TAKE", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const output = new OutputEngine();
    const decks = new Map([
      [deck1.id, deck1],
      [deck3.id, deck3]
    ]);

    output.register({
      id: "display-main",
      kind: "display",
      enabled: true
    });
    output.register({
      id: "media-main",
      kind: "media",
      enabled: true,
      deckId: "deck-3",
      media: {
        resolution: [1920, 1080],
        fps: 60,
        streaming: true,
        recording: false,
        virtual: true
      }
    });

    const state = trigger.execute(
      {
        type: "take",
        target: { deckId: "deck-3", layerId: "layer-2" }
      },
      { decks, program, output }
    );

    expect(state.source).toEqual({ deckId: "deck-3", layerId: "layer-2" });
    expect(output.getState("display-main").source).toEqual({
      deckId: "deck-3",
      layerId: "layer-2"
    });
    expect(output.getState("media-main").source).toEqual({
      deckId: "deck-3",
      layerId: "layer-2"
    });
  });

  it("supports multi-action trigger sequences", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const decks = new Map([
      [deck1.id, deck1],
      [deck3.id, deck3]
    ]);

    const state = trigger.execute(
      {
        type: "sequence",
        actions: [
          { type: "take", target: { deckId: "deck-1", layerId: "layer-2" } },
          { type: "take", target: { deckId: "deck-3", layerId: "layer-2" } }
        ]
      },
      { decks, program }
    );

    expect(state.source).toEqual({ deckId: "deck-3", layerId: "layer-2" });
    expect(state.transition?.type).toBe("wipe");
  });

  it("rejects a missing layer", () => {
    const program = new ProgramEngine();

    expect(() => program.take(deck1, "layer-99")).toThrow(
      'Layer "layer-99" does not exist in deck "deck-1".'
    );
  });
});
