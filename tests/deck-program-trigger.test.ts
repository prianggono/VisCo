import { describe, expect, it } from "vitest";
import type { Deck } from "../src/domain/deck.js";
import { ProgramEngine } from "../src/engine/program-engine.js";
import { TriggerEngine } from "../src/engine/trigger-engine.js";
import { OutputEngine } from "../src/engine/output-engine.js";
import { DeckRuntime } from "../src/engine/deck-runtime.js";
import { DeckProgramController } from "../src/engine/deck-program-controller.js";

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
    const runtime = new DeckRuntime();
    runtime.register(deck1);
    runtime.register(deck3);
    const controller = new DeckProgramController(runtime, program);
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
      { decks, controller }
    );

    expect(state.source).toEqual({ deckId: "deck-3", layerId: "layer-2" });
    expect(state.layer?.id).toBe("layer-2");
    expect(state.transition).toEqual({ type: "wipe", durationMs: 300 });
    expect(controller.getState(deck3).deck.activeLayerId).toBe("layer-2");
  });

  it("routes Trigger PROGRAM through DeckRuntime M gating", () => {
    const mutedDeck: Deck = { ...deck1, masterLevel: 0 };
    const program = new ProgramEngine();
    const runtime = new DeckRuntime();
    runtime.register(mutedDeck);
    const controller = new DeckProgramController(runtime, program);
    const trigger = new TriggerEngine();
    const decks = new Map([[mutedDeck.id, mutedDeck]]);

    expect(() =>
      trigger.execute(
        {
          type: "program",
          target: { deckId: mutedDeck.id, layerId: "layer-1" }
        },
        { decks, controller }
      )
    ).toThrow('Deck "deck-1" is muted by M and cannot enter Program.');

    expect(controller.getProgramState().source).toBeNull();
    expect(controller.getState(mutedDeck).deck.activeLayerId).toBeNull();
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
    const runtime = new DeckRuntime();
    const controller = new DeckProgramController(runtime, program);
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

    const composition = {
      id: "default",
      name: "Default",
      format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 as const },
      deckIds: ["deck-3"],
      sliceIds: ["slice-1"],
      locked: false
    };
    const slices = [{
      id: "slice-1",
      name: "Full Screen",
      transform: { x: 960, y: 540, width: 1920, height: 1080, rotation: 0 },
      layerRefs: [{ deckId: "deck-3", layerId: "layer-2" }],
      locked: false
    }];

    const state = trigger.execute(
      {
        type: "program",
        target: { deckId: "deck-3", layerId: "layer-2" }
      },
      { decks, controller, output, composition, slices }
    );

    expect(state.source).toEqual({ deckId: "deck-3", layerId: "layer-2" });
    expect(output.getState("display-main").source).toBeNull();
    expect(output.getState("display-main").renderPlan).toHaveLength(1);
    expect(output.getState("display-main").renderPlan?.[0]?.ref).toEqual({
      deckId: "deck-3",
      layerId: "layer-2"
    });
    expect(output.getState("media-main").source).toEqual({
      deckId: "deck-3",
      layerId: "layer-2"
    });
    expect(output.getState("media-main").transition).toMatchObject({
      transition: { type: "wipe", durationMs: 300 },
      active: true
    });
  });

  it("syncs outputs once after a multi-action sequence", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const output = new OutputEngine();
    const runtime = new DeckRuntime();
    const controller = new DeckProgramController(runtime, program);
    const decks = new Map([
      [deck1.id, deck1],
      [deck3.id, deck3]
    ]);

    let deckSyncs = 0;
    const originalDeckSync = output.syncFromDeck.bind(output);

    output.syncFromDeck = (deckId, source, compositionId) => {
      deckSyncs += 1;
      return originalDeckSync(deckId, source, compositionId);
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
      { decks, controller, output }
    );

    expect(state.source).toEqual({ deckId: "deck-3", layerId: "layer-2" });
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
    const runtime = new DeckRuntime();
    const controller = new DeckProgramController(runtime, program);

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
      { decks: new Map(), controller, output }
    );

    expect(output.getState("display-main").target.enabled).toBe(false);
    expect(output.getState("display-main").active).toBe(false);
  });

  it("re-syncs the current Program when a default output is re-enabled by Trigger", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const output = new OutputEngine();
    const runtime = new DeckRuntime();
    const controller = new DeckProgramController(runtime, program);

    output.register({
      id: "display-main",
      kind: "display",
      enabled: true
    });

    const composition = {
      id: "default",
      name: "Default",
      format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 as const },
      deckIds: ["deck-1"],
      sliceIds: ["slice-1"],
      locked: false
    };
    const slices = [{
      id: "slice-1",
      name: "Full Screen",
      transform: { x: 960, y: 540, width: 1920, height: 1080, rotation: 0 },
      layerRefs: [{ deckId: "deck-1", layerId: "layer-1" }],
      locked: false
    }];

    program.program(deck1, "layer-1");
    output.setEnabled("display-main", false);

    trigger.execute(
      {
        type: "set-output-enabled",
        outputId: "display-main",
        enabled: true
      },
      {
        decks: new Map([[deck1.id, deck1]]),
        controller,
        output,
        composition,
        slices
      }
    );

    expect(output.getState("display-main").active).toBe(true);
    expect(output.getState("display-main").source).toBeNull();
    expect(output.getState("display-main").renderPlan).toHaveLength(1);
  });

  it("preserves composition routing when Trigger syncs Deck outputs", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const output = new OutputEngine();
    const runtime = new DeckRuntime();
    const controller = new DeckProgramController(runtime, program);
    const mediaDeck: Deck = { ...deck3, id: "media-deck" };

    runtime.register(mediaDeck);
    output.register({
      id: "media-output",
      kind: "media",
      enabled: true,
      deckId: "media-deck",
      compositionId: "media",
      media: {
        resolution: [1920, 1080],
        fps: 60,
        streaming: true,
        recording: false,
        virtual: false
      }
    });

    trigger.execute(
      { type: "program", target: { deckId: "media-deck", layerId: "layer-2" }, compositionId: "media" },
      {
        decks: new Map([[mediaDeck.id, mediaDeck]]),
        controller,
        output
      }
    );

    expect(output.getState("media-output").source).toEqual({
      deckId: "media-deck",
      layerId: "layer-2"
    });
  });

  it("supports Stream/Record/Virtual controls as Trigger actions", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const output = new OutputEngine();
    const runtime = new DeckRuntime();
    const controller = new DeckProgramController(runtime, program);

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
      { decks: new Map(), controller, output }
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
    const runtime = new DeckRuntime();
    runtime.register(deck1);
    runtime.register(deck3);
    const controller = new DeckProgramController(runtime, program);
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
        { decks, controller }
      )
    ).not.toThrow();
  });

  it("rejects an exact duplicate command before execution", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const runtime = new DeckRuntime();
    runtime.register(deck1);
    runtime.register(deck3);
    const controller = new DeckProgramController(runtime, program);
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
        { decks, controller }
      )
    ).toThrow('Duplicate command "PROGRAM deck-1/layer-2"');
  });

  it("rejects conflicting output commands before execution", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const output = new OutputEngine();
    const runtime = new DeckRuntime();
    const controller = new DeckProgramController(runtime, program);

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
        { decks: new Map(), controller, output }
      )
    ).toThrow("Conflicting command");

    expect(output.getState("display-main").target.enabled).toBe(true);
  });

  it("rejects an invalid target before changing Program", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const runtime = new DeckRuntime();
    runtime.register(deck1);
    runtime.register(deck3);
    const controller = new DeckProgramController(runtime, program);
    const decks = new Map([[deck1.id, deck1]]);

    program.program(deck1, "layer-1");

    expect(() =>
      trigger.execute(
        {
          type: "program",
          target: { deckId: "deck-1", layerId: "layer-99" }
        },
        { decks, controller }
      )
    ).toThrow('Layer "layer-99" does not exist in deck "deck-1".');

    expect(controller.getProgramState().source).toEqual({
      deckId: "deck-1",
      layerId: "layer-1"
    });
  });

  it("supports multi-action trigger sequences", () => {
    const program = new ProgramEngine();
    const trigger = new TriggerEngine();
    const runtime = new DeckRuntime();
    runtime.register(deck1);
    runtime.register(deck3);
    const controller = new DeckProgramController(runtime, program);
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
      { decks, controller }
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
    const venueDeck: Deck = { ...deck1, id: "venue-deck" };
    const mediaDeck: Deck = { ...deck3, id: "media-deck" };

    program.program(venueDeck, "layer-1", "venue");
    program.program(mediaDeck, "layer-2", "media");

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
