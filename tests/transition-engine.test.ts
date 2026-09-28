import { describe, expect, it } from "vitest";
import type { Deck } from "../src/domain/deck.js";
import { ProgramEngine } from "../src/engine/program-engine.js";
import { TransitionEngine } from "../src/engine/transition-engine.js";

const deckA: Deck = {
  id: "deck-a",
  name: "Deck A",
  layers: [{ id: "layer-1", name: "A" }],
  transition: { type: "fade", durationMs: 500 }
};

const deckB: Deck = {
  id: "deck-b",
  name: "Deck B",
  layers: [{ id: "layer-1", name: "B" }],
  transition: { type: "wipe", durationMs: 300 }
};

describe("Transition Engine", () => {
  it("uses the target Deck transition and never stores transition on the trigger", () => {
    const program = new ProgramEngine();
    const engine = new TransitionEngine();

    const previous = program.program(deckA, "layer-1");
    const next = program.program(deckB, "layer-1");

    const run = engine.start(previous, next, 1000);

    expect(run?.compositionId).toBe("default");
    expect(run?.transition).toEqual({ type: "wipe", durationMs: 300 });
    expect(run?.from).toEqual({ deckId: "deck-a", layerId: "layer-1" });
    expect(run?.to).toEqual({ deckId: "deck-b", layerId: "layer-1" });
  });

  it("isolates concurrent transition runs by Composition", () => {
    const program = new ProgramEngine();
    const engine = new TransitionEngine();

    const offlinePrevious = program.program(deckA, "layer-1", "offline");
    const offlineNext = program.program(deckB, "layer-1", "offline");
    const onlinePrevious = program.program(deckA, "layer-1", "online");
    const onlineNext = program.program(deckB, "layer-1", "online");

    engine.start(offlinePrevious, offlineNext, 1000);
    engine.start(onlinePrevious, onlineNext, 2000);

    expect(engine.sample("offline", 1150)?.progress).toBe(0.5);
    expect(engine.sample("online", 2150)?.progress).toBe(0.5);
    expect(engine.getCurrent("offline")?.compositionId).toBe("offline");
    expect(engine.getCurrent("online")?.compositionId).toBe("online");
  });

  it("reports transition progress and completes at the configured duration", () => {
    const program = new ProgramEngine();
    const engine = new TransitionEngine();
    const previous = program.program(deckA, "layer-1");
    const next = program.program(deckB, "layer-1");

    engine.start(previous, next, 1000);

    expect(engine.sample(1000)?.progress).toBe(0);
    expect(engine.sample(1150)?.progress).toBe(0.5);
    expect(engine.sample(1300)?.progress).toBe(1);
    expect(engine.getCurrent()).toBeNull();
  });

  it("completes Cut immediately", () => {
    const program = new ProgramEngine();
    const engine = new TransitionEngine();
    const previous = program.program(deckA, "layer-1");
    const cutDeck: Deck = {
      ...deckB,
      transition: { type: "cut", durationMs: 0 }
    };
    const next = program.program(cutDeck, "layer-1");

    engine.start(previous, next, 1000);

    const sample = engine.sample(1000);
    expect(sample?.active).toBe(false);
    expect(sample?.progress).toBe(1);
    expect(engine.getCurrent()).toBeNull();
  });
});
