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

    expect(state.sourceDecks).toHaveLength(1);
    expect(state.sourceDecks[0]?.deckId).toBe("audio-deck-1");
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

    expect(state.sourceDecks).toHaveLength(1);
    expect(state.outputs).toEqual([]);
  });
});
