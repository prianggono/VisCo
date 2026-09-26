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
});
