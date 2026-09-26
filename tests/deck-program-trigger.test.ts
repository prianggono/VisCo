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
    const state = program.program(deck1, "layer-2");

    expect(state.source).toEqual({ deckId: "deck-1", layerId: "layer-2" });
    expect(state.layer?.id).toBe("layer-2");
    expect(state.transition).toEqual({ type: "fade", durationMs: 500 });
  });

  it("trigger can program Deck 3 / Layer 2 and Program uses Deck 3 transition", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const decks = new Map([
      [deck1.id, deck1],
      [deck3.id, deck3]
    ]);

    program.program(deck1, "layer-2");

    const state = trigger.execute(
      {
        type: "program",
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
      type: "program" as const,
      target: { deckId: "deck-3", layerId: "layer-2" }
    };

    expect(action).not.toHaveProperty("transition");
  });

  it("syncs Program and Deck-routed outputs from one Trigger PROGRAM", () => {
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
        type: "program",
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

  it("syncs outputs once after a multi-action sequence", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const output = new OutputEngine();
    const decks = new Map([
      [deck1.id, deck1],
      [deck3.id, deck3]
    ]);

    let programSyncs = 0;
    let deckSyncs = 0;
    const originalProgramSync = output.syncFromProgram.bind(output);
    const originalDeckSync = output.syncFromDeck.bind(output);

    output.syncFromProgram = (source) => {
      programSyncs += 1;
      return originalProgramSync(source);
    };
    output.syncFromDeck = (deckId, source) => {
      deckSyncs += 1;
      return originalDeckSync(deckId, source);
    };

    output.register({
      id: "display-main",
      kind: "display",
      enabled: true
    });

    const state = trigger.execute(
      {
        type: "sequence",
        actions: [
          { type: "program", target: { deckId: "deck-1", layerId: "layer-1" } },
          { type: "program", target: { deckId: "deck-3", layerId: "layer-2" } }
        ]
      },
      { decks, program, output }
    );

    expect(state.source).toEqual({ deckId: "deck-3", layerId: "layer-2" });
    expect(programSyncs).toBe(1);
    expect(deckSyncs).toBe(1);
    expect(output.getState("display-main").source).toEqual({
      deckId: "deck-3",
      layerId: "layer-2"
    });
  });

  it("supports output enable/disable as a Trigger action", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const output = new OutputEngine();

    output.register({
      id: "display-main",
      kind: "display",
      enabled: true
    });

    trigger.execute(
      {
        type: "set-output-enabled",
        outputId: "display-main",
        enabled: false
      },
      { decks: new Map(), program, output }
    );

    expect(output.getState("display-main").target.enabled).toBe(false);
    expect(output.getState("display-main").active).toBe(false);
  });

  it("re-syncs the current Program when a default output is re-enabled by Trigger", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const output = new OutputEngine();

    output.register({
      id: "display-main",
      kind: "display",
      enabled: true
    });

    program.program(deck1, "layer-1");
    output.syncFromProgram({ deckId: "deck-1", layerId: "layer-1" });
    output.setEnabled("display-main", false);

    trigger.execute(
      {
        type: "set-output-enabled",
        outputId: "display-main",
        enabled: true
      },
      { decks: new Map([[deck1.id, deck1]]), program, output }
    );

    expect(output.getState("display-main").active).toBe(true);
    expect(output.getState("display-main").source).toEqual({
      deckId: "deck-1",
      layerId: "layer-1"
    });
  });

  it("supports Stream/Record/Virtual controls as Trigger actions", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const output = new OutputEngine();

    output.register({
      id: "media-main",
      kind: "media",
      enabled: true,
      media: {
        resolution: [1920, 1080],
        fps: 60,
        streaming: false,
        recording: false,
        virtual: false
      }
    });

    trigger.execute(
      {
        type: "sequence",
        actions: [
          {
            type: "set-media-feature",
            outputId: "media-main",
            feature: "stream",
            enabled: true
          },
          {
            type: "set-media-feature",
            outputId: "media-main",
            feature: "record",
            enabled: true
          },
          {
            type: "set-media-feature",
            outputId: "media-main",
            feature: "virtual",
            enabled: true
          }
        ]
      },
      { decks: new Map(), program, output }
    );

    expect(output.getState("media-main").target.media).toEqual({
      resolution: [1920, 1080],
      fps: 60,
      streaming: true,
      recording: true,
      virtual: true
    });
  });

  it("allows the same command type when its targets are different", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const decks = new Map([
      [deck1.id, deck1],
      [deck3.id, deck3]
    ]);

    expect(() =>
      trigger.execute(
        {
          type: "sequence",
          actions: [
            { type: "program", target: { deckId: "deck-1", layerId: "layer-2" } },
            { type: "program", target: { deckId: "deck-3", layerId: "layer-2" } }
          ]
        },
        { decks, program }
      )
    ).not.toThrow();
  });

  it("rejects an exact duplicate command before execution", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const decks = new Map([[deck1.id, deck1]]);

    expect(() =>
      trigger.execute(
        {
          type: "sequence",
          actions: [
            { type: "program", target: { deckId: "deck-1", layerId: "layer-2" } },
            { type: "program", target: { deckId: "deck-1", layerId: "layer-2" } }
          ]
        },
        { decks, program }
      )
    ).toThrow('Duplicate command "PROGRAM deck-1/layer-2"');
  });

  it("rejects conflicting output commands before execution", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const output = new OutputEngine();

    output.register({
      id: "display-main",
      kind: "display",
      enabled: true
    });

    expect(() =>
      trigger.execute(
        {
          type: "sequence",
          actions: [
            {
              type: "set-output-enabled",
              outputId: "display-main",
              enabled: true
            },
            {
              type: "set-output-enabled",
              outputId: "display-main",
              enabled: false
            }
          ]
        },
        { decks: new Map(), program, output }
      )
    ).toThrow("Conflicting command");

    expect(output.getState("display-main").target.enabled).toBe(true);
  });

  it("rejects an invalid target before changing Program", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const decks = new Map([[deck1.id, deck1]]);

    program.program(deck1, "layer-1");

    expect(() =>
      trigger.execute(
        {
          type: "program",
          target: { deckId: "deck-1", layerId: "layer-99" }
        },
        { decks, program }
      )
    ).toThrow('Layer "layer-99" does not exist in deck "deck-1".');

    expect(program.getState().source).toEqual({
      deckId: "deck-1",
      layerId: "layer-1"
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
          { type: "program", target: { deckId: "deck-1", layerId: "layer-2" } },
          { type: "program", target: { deckId: "deck-3", layerId: "layer-2" } }
        ]
      },
      { decks, program }
    );

    expect(state.source).toEqual({ deckId: "deck-3", layerId: "layer-2" });
    expect(state.transition?.type).toBe("wipe");
  });

  it("rejects a missing layer", () => {
    const program = new ProgramEngine();

    expect(() => program.program(deck1, "layer-99")).toThrow(
      'Layer "layer-99" does not exist in deck "deck-1".'
    );
  });
  it("keeps Program state independent between Venue and Media compositions", () => {
    const program = new ProgramEngine();
    const venueDeck: Deck = { ...deck1, id: "venue-deck", compositionId: "venue" };
    const mediaDeck: Deck = { ...deck3, id: "media-deck", compositionId: "media" };

    program.program(venueDeck, "layer-1");
    program.program(mediaDeck, "layer-2");

    expect(program.getState("venue").source).toEqual({
      deckId: "venue-deck",
      layerId: "layer-1"
    });
    expect(program.getState("media").source).toEqual({
      deckId: "media-deck",
      layerId: "layer-2"
    });
  });
});
