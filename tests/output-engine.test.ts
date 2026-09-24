import { describe, expect, it } from "vitest";
import type { ProgramState } from "../src/engine/program-engine.js";
import { OutputEngine } from "../src/engine/output-engine.js";

const program: ProgramState = {
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

    const state = output.route("led-main", program);

    expect(state.active).toBe(true);
    expect(state.source).toEqual({ deckId: "deck-3", layerId: "layer-2" });
  });

  it("keeps outputs independent", () => {
    const output = new OutputEngine();
    output.register({ id: "led-main", kind: "led", enabled: true });
    output.register({ id: "stream-main", kind: "stream", enabled: true });
    output.register({ id: "record-main", kind: "record", enabled: true });

    output.route("led-main", program);
    output.route("stream-main", program);

    expect(output.getState("led-main").active).toBe(true);
    expect(output.getState("stream-main").active).toBe(true);
    expect(output.getState("record-main").active).toBe(false);
  });

  it("does not route to a disabled output", () => {
    const output = new OutputEngine();
    output.register({ id: "led-main", kind: "led", enabled: false });

    expect(() => output.route("led-main", program)).toThrow(
      'Output "led-main" is disabled.'
    );
  });

  it("can stop an active output without changing Program", () => {
    const output = new OutputEngine();
    output.register({ id: "record-main", kind: "record", enabled: true });

    output.route("record-main", program);
    const state = output.stop("record-main");

    expect(state.active).toBe(false);
    expect(state.source).toEqual(program.source);
  });
});
