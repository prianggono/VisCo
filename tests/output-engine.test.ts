import { describe, expect, it } from "vitest";
import { OutputEngine, type OutputTarget } from "../src/engine/output-engine.js";

const deck1Layer2 = { deckId: "deck-1", layerId: "layer-2" };
const deck2Layer1 = { deckId: "deck-2", layerId: "layer-1" };
const deck2Layer2 = { deckId: "deck-2", layerId: "layer-2" };

const mediaTarget = (overrides: Partial<OutputTarget> = {}): OutputTarget => ({
  id: "media-main",
  kind: "media",
  enabled: true,
  deckId: "deck-2",
  media: {
    resolution: [1920, 1080],
    fps: 60,
    streaming: false,
    recording: false,
    virtual: false
  },
  ...overrides
});

describe("Output Engine", () => {
  it("registers Display separately from the shared Media Output Pipeline", () => {
    const output = new OutputEngine();

    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      deckId: "deck-1"
    });
    output.register(mediaTarget());

    expect(output.getState("display-main").target.kind).toBe("display");
    expect(output.getState("media-main").target.kind).toBe("media");
  });

  it("rejects media output without shared media settings", () => {
    const output = new OutputEngine();

    expect(() =>
      output.register({
        id: "media-main",
        kind: "media",
        enabled: true,
        deckId: "deck-2"
      })
    ).toThrow('Media output "media-main" requires media settings.');
  });


  it("clears stale Composition render data when Composition scope changes", () => {
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      compositionId: "composition-1"
    });

    const renderPlan = [{
      sliceId: "slice-1",
      layerId: "layer-1",
      layerStyle: {
        transform: "translate(-50%, -50%) translate(0px, 0px) rotate(0deg) scale(1, 1)",
        opacity: 1,
        transformOrigin: "center center" as const,
        zIndex: 0,
        mixBlendMode: "normal" as const
      },
      sliceStyle: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 }
    }];

    output.syncFromComposition(renderPlan, "composition-1");
    output.setCompositionTarget("display-main", "composition-2");

    const state = output.getState("display-main");
    expect(state.target.compositionId).toBe("composition-2");
    expect(state.source).toBeNull();
    expect(state.renderPlan).toBeNull();
  });

  it("clears stale Deck routing when Deck scope changes", () => {
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      deckId: "deck-1"
    });

    output.route("display-main", deck1Layer2);
    output.setDeckTarget("display-main", "deck-2");

    const state = output.getState("display-main");
    expect(state.target.deckId).toBe("deck-2");
    expect(state.source).toBeNull();
    expect(state.renderPlan).toBeNull();
  });

  it("carries the active Deck transition into Composition output", () => {
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      compositionId: "composition-1"
    });

    const renderPlan = [{
      sliceId: "slice-1",
      layerId: "layer-2",
      layerStyle: {
        transform: "translate(-50%, -50%) translate(0px, 0px) rotate(0deg) scale(1, 1)",
        opacity: 1,
        transformOrigin: "center center" as const,
        zIndex: 0,
        mixBlendMode: "normal" as const
      },
      sliceStyle: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 }
    }];
    const transition = {
      active: true,
      progress: 0.5,
      from: { deckId: "deck-1", layerId: "layer-1" },
      to: { deckId: "deck-2", layerId: "layer-2" },
      transition: { type: "fade" as const, durationMs: 500 }
    };

    output.syncFromComposition(renderPlan, "composition-1", transition);

    expect(output.getState("display-main").transition).toEqual(transition);
  });

  it("carries the same Deck transition into a Deck-scoped output", () => {
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      deckId: "deck-2",
      compositionId: "composition-1"
    });

    const transition = {
      active: true,
      progress: 0.25,
      from: { deckId: "deck-1", layerId: "layer-1" },
      to: { deckId: "deck-2", layerId: "layer-2" },
      transition: { type: "wipe" as const, durationMs: 300 }
    };

    output.syncFromDeck(
      "deck-2",
      { deckId: "deck-2", layerId: "layer-2" },
      "composition-1",
      transition
    );

    expect(output.getState("display-main").transition).toEqual(transition);
  });

  it("routes a Deck source to its output", () => {
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      deckId: "deck-1"
    });

    const state = output.route("display-main", deck1Layer2);

    expect(state.active).toBe(true);
    expect(state.source).toEqual(deck1Layer2);
  });

  it("keeps Stream, Record and Virtual as independent switches on one pipeline", () => {
    const output = new OutputEngine();
    output.register(mediaTarget());

    output.setMediaFeature("media-main", "stream", true);
    output.setMediaFeature("media-main", "virtual", true);

    expect(output.getState("media-main").target.media).toEqual({
      resolution: [1920, 1080],
      fps: 60,
      streaming: true,
      recording: false,
      virtual: true
    });
  });

  it("keeps Virtual Out independent from Stream and Record", () => {
    const output = new OutputEngine();
    output.register(mediaTarget());

    output.setMediaFeature("media-main", "virtual", true);
    expect(output.getState("media-main").target.media).toMatchObject({
      streaming: false,
      recording: false,
      virtual: true
    });

    output.setMediaFeature("media-main", "stream", true);
    expect(output.getState("media-main").target.media).toMatchObject({
      streaming: true,
      recording: false,
      virtual: true
    });

    output.setMediaFeature("media-main", "record", true);
    expect(output.getState("media-main").target.media).toMatchObject({
      streaming: true,
      recording: true,
      virtual: true
    });

    output.setMediaFeature("media-main", "stream", false);
    expect(output.getState("media-main").target.media).toMatchObject({
      streaming: false,
      recording: true,
      virtual: true
    });
  });

  it("shares one resolution and FPS configuration for all media outputs", () => {
    const output = new OutputEngine();
    output.register(
      mediaTarget({
        media: {
          resolution: [3840, 2160],
          fps: 30,
          streaming: true,
          recording: true,
          virtual: false
        }
      })
    );

    const media = output.getState("media-main").target.media;
    expect(media?.resolution).toEqual([3840, 2160]);
    expect(media?.fps).toBe(30);
  });

  it("defaults enabled outputs to Program and syncs Program targets", () => {
    const output = new OutputEngine();

    output.register({
      id: "display-main",
      kind: "display",
      enabled: true
    });
    output.register(mediaTarget({ deckId: undefined }));

    expect(output.getState("display-main").active).toBe(true);
    expect(output.getState("media-main").active).toBe(true);

    const states = output.syncFromProgram(deck2Layer1);

    expect(states).toHaveLength(2);
    expect(output.getState("display-main").source).toEqual(deck2Layer1);
    expect(output.getState("media-main").source).toEqual(deck2Layer1);
  });

  it("does not let a Deck override follow Program", () => {
    const output = new OutputEngine();

    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      deckId: "deck-1"
    });
    output.route("display-main", deck1Layer2);

    output.syncFromProgram(deck2Layer1);

    expect(output.getState("display-main").source).toEqual(deck1Layer2);
  });

  it("syncs only active outputs assigned to the requested Deck", () => {
    const output = new OutputEngine();

    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      deckId: "deck-1"
    });
    output.register(mediaTarget());

    output.route("display-main", deck1Layer2);
    output.route("media-main", deck2Layer1);

    const states = output.syncFromDeck("deck-2", deck2Layer2);

    expect(states).toHaveLength(1);
    expect(states[0]?.target.id).toBe("media-main");
    expect(output.getState("display-main").source).toEqual(deck1Layer2);
    expect(output.getState("media-main").source).toEqual(deck2Layer2);
  });

  it("does not let a Deck override cross a Composition boundary", () => {
    const output = new OutputEngine();

    output.register({
      id: "display-media",
      kind: "display",
      enabled: true,
      deckId: "deck-1",
      compositionId: "media"
    });
    output.route("display-media", deck1Layer2);

    const states = output.syncFromDeck("deck-1", deck1Layer2, "venue");

    expect(states).toHaveLength(0);
    expect(output.getState("display-media").source).toEqual(deck1Layer2);
  });

  it("does not route to a disabled output", () => {
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: false,
      deckId: "deck-1"
    });

    expect(() => output.route("display-main", deck1Layer2)).toThrow(
      'Output "display-main" is disabled.'
    );
  });

  it("re-enables an output after it was stopped", () => {
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      deckId: "deck-1"
    });

    output.route("display-main", deck1Layer2);
    output.stop("display-main");
    const state = output.setEnabled("display-main", true);

    expect(state.target.enabled).toBe(true);
    expect(state.active).toBe(true);
  });

  it("can stop an active output without changing its source", () => {
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      deckId: "deck-1"
    });

    output.route("display-main", deck1Layer2);
    const state = output.stop("display-main");

    expect(state.active).toBe(false);
    expect(state.source).toEqual(deck1Layer2);
  });


  it("keeps Stream and Record encoder settings independent while sharing Media Composition", () => {
    const output = new OutputEngine();
    output.register(mediaTarget({
      media: {
        compositionId: "media-composition",
        resolution: [1920, 1080],
        fps: 29.97,
        streaming: true,
        recording: true,
        virtual: true,
        stream: {
          resolution: [1920, 1080],
          fps: 29.97,
          codec: "h264",
          bitrate: "auto",
          server: "rtmp://example",
          key: "secret"
        },
        record: {
          resolution: [3840, 2160],
          fps: 60,
          codec: "h264",
          bitrate: 20000000,
          segmentMinutes: 5,
          targetFolder: "D:/Recordings"
        }
      }
    }));

    const media = output.getState("media-main").target.media;
    expect(media?.compositionId).toBe("media-composition");
    expect(media?.stream?.resolution).toEqual([1920, 1080]);
    expect(media?.record?.resolution).toEqual([3840, 2160]);
    expect(media?.record?.fps).toBe(60);
  });

  it("clears a Composition render plan when legacy source routing is used", () => {
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      compositionId: "composition-1"
    });

    const renderPlan = [{
      sliceId: "slice-1",
      ref: { deckId: "deck-1", layerId: "layer-1" },
      layerId: "layer-1",
      layerStyle: {
        transform: "translate(-50%, -50%) translate(0px, 0px) rotate(0deg) scale(1, 1)",
        opacity: 1,
        transformOrigin: "center center" as const,
        zIndex: 0,
        mixBlendMode: "normal" as const
      },
      sliceStyle: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 }
    }];

    output.syncFromComposition(renderPlan, "composition-1");
    output.route("display-main", deck1Layer2);

    expect(output.getState("display-main").renderPlan).toBeNull();
    expect(output.getState("display-main").source).toEqual(deck1Layer2);
  });

  it("clears legacy source when Composition render becomes canonical", () => {
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      compositionId: "composition-1"
    });

    output.route("display-main", deck1Layer2);

    const renderPlan = [{
      sliceId: "slice-1",
      layerId: "layer-1",
      layerStyle: {
        transform: "translate(-50%, -50%) translate(0px, 0px) rotate(0deg) scale(1, 1)",
        opacity: 1,
        transformOrigin: "center center" as const,
        zIndex: 0,
        mixBlendMode: "normal" as const
      },
      sliceStyle: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 }
    }];

    output.syncFromComposition(renderPlan, "composition-1");

    expect(output.getState("display-main").source).toBeNull();
    expect(output.getState("display-main").renderPlan).toEqual(renderPlan);
  });

  it("routes a Composition render plan without replacing Layer ownership", () => {
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      compositionId: "composition-1"
    });

    const renderPlan = [{
      sliceId: "slice-1",
      ref: { deckId: "deck-1", layerId: "layer-1" },
      layerId: "layer-1",
      layerStyle: {
        transform: "translate(-50%, -50%) translate(10px, 20px) rotate(0deg) scale(1, 1)",
        opacity: 1,
        transformOrigin: "center center" as const,
        zIndex: 1,
        mixBlendMode: "normal" as const
      },
      sliceStyle: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 }
    }];

    const states = output.syncFromComposition(renderPlan, "composition-1");

    expect(states).toHaveLength(1);
    expect(output.getState("display-main").renderPlan).toEqual(renderPlan);
    expect(output.getState("display-main").source).toBeNull();
  });

  it("retains the previous Composition render plan for transition rendering", () => {
    const output = new OutputEngine();
    output.register({
      id: "display-main",
      kind: "display",
      enabled: true,
      compositionId: "composition-1"
    });

    const first = [{
      sliceId: "slice-1",
      ref: { deckId: "deck-1", layerId: "layer-1" },
      layerId: "layer-1",
      layerStyle: {
        transform: "translate(0px, 0px)",
        opacity: 100,
        transformOrigin: "center center" as const,
        zIndex: 0,
        mixBlendMode: "normal" as const
      },
      sliceStyle: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 }
    }];

    const second = [{
      ...first[0],
      ref: { deckId: "deck-1", layerId: "layer-2" },
      layerId: "layer-2"
    }];

    output.syncFromComposition(first, "composition-1");
    output.syncFromComposition(second, "composition-1");

    expect(output.getState("display-main").previousRenderPlan).toEqual(first);
    expect(output.getState("display-main").renderPlan).toEqual(second);
  });


});
