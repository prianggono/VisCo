import { describe, expect, it } from "vitest";
import type { ProgramState } from "../src/engine/program-engine.js";
import { OutputEngine } from "../src/engine/output-engine.js";

const program1: ProgramState = {
  source: { deckId: "deck-1", layerId: "layer-2" },
  layer: { id: "layer-2", name: "Layer 2" },
  transition: { type: "fade", durationMs: 500 }
};

const program3: ProgramState = {
  source: { deckId: "deck-3", layerId: "layer-2" },
  layer: { id: "layer-2", name: "Layer 2" },
  transition: { type: "wipe", durationMs: 300 }
};

describe("Output Engine", () => {
  it("registers LED, Stream and Record independently", () => {
    const output = new OutputEngine();

    output.register({ id: "led-main", kind: "led", enabled: true });
    output.register({ id: "stream-main", kind: "stream", enabled: true });
    output.register({ id: "record-main", kind: "record", enabled: true });

    expect(output.getState("led-main").target.kind).toBe("led");
    expect(output.getState("stream-main").target.kind).toBe("stream");
    expect(output.getState("record-main").target.kind).toBe("record");
  });

  it("routes the current Program source to LED", () => {
    const output = new OutputEngine();
    output.register({ id: "led-main", kind: "led", enabled: true });

    const state = output.route("led-main", program3);

    expect(state.active).toBe(true);
    expect(state.source).toEqual({ deckId: "deck-3", layerId: "layer-2" });
  });

  it("routes Program to multiple outputs without coupling them", () => {
    const output = new OutputEngine();
    output.register({ id: "led-main", kind: "led", enabled: true });
    output.register({ id: "stream-main", kind: "stream", enabled: true });
    output.register({ id: "record-main", kind: "record", enabled: true });

    const states = output.routeMany(["led-main", "stream-main"], program1);

    expect(states).toHaveLength(2);
    expect(output.getState("led-main").active).toBe(true);
    expect(output.getState("stream-main").active).toBe(true);
    expect(output.getState("record-main").active).toBe(false);
  });

  it("syncs only active outputs when Program changes", () => {
    const output = new OutputEngine();
    output.register({ id: "led-main", kind: "led", enabled: true });
    output.register({ id: "stream-main", kind: "stream", enabled: true });
    output.register({ id: "record-main", kind: "record", enabled: true });

    output.route("led-main", program1);
    output.route("stream-main", program1);

    const states = output.syncFromProgram(program3);

    expect(states).toHaveLength(2);
    expect(output.getState("led-main").source).toEqual(program3.source);
    expect(output.getState("stream-main").source).toEqual(program3.source);
    expect(output.getState("record-main").source).toBeNull();
  });

  it("does not route to a disabled output", () => {
    const output = new OutputEngine();
    output.register({ id: "led-main", kind: "led", enabled: false });

    expect(() => output.route("led-main", program1)).toThrow(
      'Output "led-main" is disabled.'
    );
  });

  it("can stop an active output without changing Program", () => {
    const output = new OutputEngine();
    output.register({ id: "record-main", kind: "record", enabled: true });

    output.route("record-main", program1);
    const state = output.stop("record-main");

    expect(state.active).toBe(false);
    expect(state.source).toEqual(program1.source);
  });
});
