import { describe, expect, it } from "vitest";
import { AudioEngine } from "../src/domain/audio.js";
import { AudioOutputRouter } from "../src/engine/audio-output-router.js";
import { OutputEngine } from "../src/engine/output-engine.js";

describe("Audio Output Router", () => {
  it("connects active Audio Decks to enabled shared Media Output features", () => {
    const audio = new AudioEngine();
    const output = new OutputEngine();

    audio.registerDeck("audio-deck-1");
    audio.selectLayer("audio-deck-1", "layer-1");

    output.register({
      id: "media-output",
      kind: "media",
      enabled: true,
      media: {
        resolution: [1920, 1080],
        fps: 30,
        streaming: true,
        recording: false,
        virtual: true
      }
    });

    const state = new AudioOutputRouter(audio, output).sync();

    expect(state.mix.sources).toHaveLength(1);
    expect(state.mix.sources[0]).toEqual({
      deckId: "audio-deck-1",
      layerId: "layer-1",
      gain: 1
    });
    expect(state.outputs).toEqual(["media-output"]);
  });

  it("does not expose disabled Media Output as an audio destination", () => {
    const audio = new AudioEngine();
    const output = new OutputEngine();

    audio.registerDeck("audio-deck-1");
    audio.selectLayer("audio-deck-1", "layer-1");

    output.register({
      id: "media-output",
      kind: "media",
      enabled: false,
      media: {
        resolution: [1920, 1080],
        fps: 30,
        streaming: true,
        recording: true,
        virtual: true
      }
    });

    const state = new AudioOutputRouter(audio, output).sync();

    expect(state.mix.sources).toHaveLength(1);
    expect(state.outputs).toEqual([]);
  });

  it("mixes multiple active Audio Decks using their individual levels", () => {
    const audio = new AudioEngine();

    audio.registerDeck("audio-deck-1");
    audio.registerDeck("audio-deck-2");
    audio.selectLayer("audio-deck-1", "layer-1");
    audio.selectLayer("audio-deck-2", "layer-2");
    audio.setLevel("audio-deck-1", 75);
    audio.setLevel("audio-deck-2", 40);

    expect(audio.getMasterMix()).toEqual({
      sources: [
        { deckId: "audio-deck-1", layerId: "layer-1", gain: 0.75 },
        { deckId: "audio-deck-2", layerId: "layer-2", gain: 0.4 }
      ]
    });
  });

  it("excludes muted Audio Decks from the Master Audio mix", () => {
    const audio = new AudioEngine();

    audio.registerDeck("audio-deck-1");
    audio.registerDeck("audio-deck-2");
    audio.selectLayer("audio-deck-1", "layer-1");
    audio.selectLayer("audio-deck-2", "layer-2");
    audio.setEnabled("audio-deck-2", false);

    expect(audio.getMasterMix()).toEqual({
      sources: [
        { deckId: "audio-deck-1", layerId: "layer-1", gain: 1 }
      ]
    });
  });
});
