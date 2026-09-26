import { describe, expect, it } from "vitest";
import type { Deck } from "../src/domain/deck.js";
import { DeckRuntime } from "../src/engine/deck-runtime.js";
import { ProgramEngine } from "../src/engine/program-engine.js";
import { AudioEngine, AudioRoutingEngine } from "../src/domain/audio.js";

const deck: Deck = {
  id: "deck-m",
  name: "Muted Deck",
  layers: [{ id: "layer-1", name: "Layer 1" }],
  masterLevel: 0,
  transition: { type: "fade", durationMs: 500 }
};

describe("Deck M gate", () => {
  it("allows Preview while M is OFF", () => {
    const runtime = new DeckRuntime();
    runtime.register(deck);
    expect(runtime.previewLayer(deck, "layer-1").previewLayerId).toBe("layer-1");
  });

  it("blocks Program while M is OFF", () => {
    const program = new ProgramEngine();
    expect(() => program.program(deck, "layer-1")).toThrow(
      'Deck "deck-m" is muted by M and cannot enter Program.'
    );
  });

  it("X deselects active layer without clearing Preview", () => {
    const runtime = new DeckRuntime();
    runtime.register({ ...deck, masterLevel: 100 });
    runtime.programLayer({ ...deck, masterLevel: 100 }, "layer-1");
    const state = runtime.deselectActiveLayer("deck-m");
    expect(state.activeLayerId).toBeNull();
    expect(state.previewLayerId).toBe("layer-1");
  });
  it("Column toggle controls the matching layer playback", () => {
    const runtime = new DeckRuntime();
    runtime.register({ ...deck, masterLevel: 100, layers: [
      { id: "layer-1", name: "Layer 1" },
      { id: "layer-2", name: "Layer 2" }
    ] });

    runtime.setColumnEnabled("deck-m", 2, true);
    expect(runtime.getState("deck-m").columns.get(2)).toBe(true);
    expect(runtime.getState("deck-m").playback.get("layer-2")?.playing).toBe(true);

    runtime.setColumnEnabled("deck-m", 2, false);
    expect(runtime.getState("deck-m").columns.get(2)).toBe(false);
    expect(runtime.getState("deck-m").playback.get("layer-2")?.playing).toBe(false);
  });

  it("advances List cursor and loops only when enabled", () => {
    const runtime = new DeckRuntime();
    runtime.register({ ...deck, masterLevel: 100 });
    expect(runtime.advanceList("deck-m", "layer-1", 2, false).index).toBe(0);
    expect(runtime.advanceList("deck-m", "layer-1", 2, false).index).toBe(1);
    expect(runtime.advanceList("deck-m", "layer-1", 2, false).index).toBeNull();
    expect(runtime.advanceList("deck-m", "layer-1", 2, true).index).toBe(0);
  });

  it("enforces Audio In -> VB -> Record/Stream/Zoom and keeps monitoring diagnostic", () => {
    const routing = new AudioRoutingEngine();

    const input = routing.connect("sound-card-1", "audio-in", "visco-vb");
    expect(input.enabled).toBe(true);

    for (const destination of ["record", "stream", "zoom"] as const) {
      const route = routing.connect(`vb-${destination}`, "visco-vb", destination);
      expect(route.enabled).toBe(true);
      expect(route.sourceBus).toBe("visco-vb");
      expect(route.targetBus).toBe(destination);
    }

    expect(routing.getDestinationsFromVb()).toEqual(["record", "stream", "zoom"]);
    expect(() => routing.connect("master-send", "master", "visco-vb")).toThrow();
    expect(() => routing.connect("bad", "visco-vb", "master")).toThrow();

    const monitoring = routing.setSignalPresent("sound-card-1", "audio-in", true);
    expect(monitoring.signalPresent).toBe(true);
    expect(routing.getSignalState("sound-card-1", "audio-in")?.signalPresent).toBe(true);
  });

  it("keeps Audio Deck out of visual Program and controls its audio state separately", () => {
    const audio = new AudioEngine();
    const state = audio.registerDeck("audio-1");
    expect(state.layerId).toBeNull();
    expect(audio.selectLayer("audio-1", "layer-1").layerId).toBe("layer-1");
    expect(audio.setLevel("audio-1", 140).level).toBe(100);
    expect(audio.setEnabled("audio-1", false).enabled).toBe(false);
  });
});
