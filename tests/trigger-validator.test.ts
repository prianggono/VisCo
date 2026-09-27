import { describe, expect, it } from "vitest";
import type { TriggerContext } from "../src/engine/trigger-engine.js";
import { validateTriggerAction } from "../src/engine/trigger-validator.js";
import { OutputEngine } from "../src/engine/output-engine.js";

const deck = {
  id: "deck-1",
  name: "Deck 1",
  layers: [
    { id: "layer-1", name: "Layer 1" },
    { id: "layer-2", name: "Layer 2" }
  ],
  transition: { type: "fade" as const, durationMs: 300 }
};

const baseContext = (): TriggerContext => ({
  decks: new Map([[deck.id, deck]]),
  controller: {} as TriggerContext["controller"]
});

describe("Trigger validator", () => {
  it("rejects the same Program command twice in one Trigger", () => {
    const result = validateTriggerAction({
      type: "sequence",
      actions: [
        { type: "program", target: { deckId: "deck-1", layerId: "layer-1" } },
        { type: "program", target: { deckId: "deck-1", layerId: "layer-1" } }
      ]
    }, baseContext());

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("duplicate-command");
  });

  it("allows a Program sequence to move between different Layers", () => {
    const result = validateTriggerAction({
      type: "sequence",
      actions: [
        { type: "program", target: { deckId: "deck-1", layerId: "layer-1" } },
        { type: "program", target: { deckId: "deck-1", layerId: "layer-2" } }
      ]
    }, baseContext());

    expect(result.valid).toBe(true);
  });

  it("rejects conflicting output enable commands", () => {
    const output = new OutputEngine();
    output.register({ id: "display-main", kind: "display", enabled: true });

    const result = validateTriggerAction({
      type: "sequence",
      actions: [
        { type: "set-output-enabled", outputId: "display-main", enabled: true },
        { type: "set-output-enabled", outputId: "display-main", enabled: false }
      ]
    }, { ...baseContext(), output });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("conflicting-command");
  });

  it("rejects output commands targeting a missing output", () => {
    const result = validateTriggerAction({
      type: "set-output-enabled",
      outputId: "missing",
      enabled: true
    }, baseContext());

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("missing-output");
  });

  it("rejects media feature commands on a Display output", () => {
    const output = new OutputEngine();
    output.register({ id: "display-main", kind: "display", enabled: true });

    const result = validateTriggerAction({
      type: "set-media-feature",
      outputId: "display-main",
      feature: "stream",
      enabled: true
    }, { ...baseContext(), output });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("invalid-output-action");
  });
});
