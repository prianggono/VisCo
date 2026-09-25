import { findLayer } from "../domain/deck.js";
import type { TriggerAction, TriggerContext } from "./trigger-engine.js";

export type TriggerIssueSeverity = "error";

export interface TriggerIssue {
  readonly severity: TriggerIssueSeverity;
  readonly code:
    | "missing-deck" | "missing-layer" | "missing-output"
    | "invalid-output-action" | "duplicate-command" | "conflicting-command";
  readonly path: readonly number[];
  readonly message: string;
}

export interface TriggerValidationResult {
  readonly valid: boolean;
  readonly issues: readonly TriggerIssue[];
}

interface CommandKey {
  readonly key: string;
  readonly path: readonly number[];
  readonly description: string;
  readonly value?: boolean;
}

export function validateTriggerAction(action: TriggerAction, context: TriggerContext): TriggerValidationResult {
  const issues: TriggerIssue[] = [];
  const commands = new Map<string, CommandKey>();

  const registerCommand = (command: CommandKey): void => {
    const previous = commands.get(command.key);
    if (!previous) { commands.set(command.key, command); return; }
    const same = previous.value === command.value;
    issues.push({
      severity: "error",
      code: same ? "duplicate-command" : "conflicting-command",
      path: command.path,
      message: same
        ? `Duplicate command "${command.description}" conflicts with action [${previous.path.join(", ")}].`
        : `Conflicting command "${command.description}" changes the same target to different states (previous action [${previous.path.join(", ")}]).`
    });
  };

  const visit = (current: TriggerAction, path: readonly number[]): void => {
    switch (current.type) {
      case "program": {
        const deck = context.decks.get(current.target.deckId);
        if (!deck) {
          issues.push({ severity: "error", code: "missing-deck", path, message: `Deck "${current.target.deckId}" does not exist.` });
          break;
        }
        try { findLayer(deck, current.target.layerId); }
        catch (error) {
          issues.push({
            severity: "error",
            code: "missing-layer",
            path,
            message: error instanceof Error ? error.message : `Layer "${current.target.layerId}" does not exist in deck "${deck.id}".`
          });
        }
        registerCommand({
          key: `program:${current.target.deckId}:${current.target.layerId}`,
          path,
          description: `PROGRAM ${current.target.deckId}/${current.target.layerId}`
        });
        break;
      }
      case "sequence":
        current.actions.forEach((nested, index) => visit(nested, [...path, index]));
        break;
      case "set-output-enabled": {
        if (!context.output) {
          issues.push({ severity: "error", code: "missing-output", path, message: "Output engine is required for output trigger actions." });
          break;
        }
        try { context.output.getState(current.outputId); }
        catch (error) {
          issues.push({ severity: "error", code: "missing-output", path, message: error instanceof Error ? error.message : `Output "${current.outputId}" does not exist.` });
          break;
        }
        registerCommand({ key: `output-enabled:${current.outputId}`, path, description: `OUTPUT ${current.outputId}`, value: current.enabled });
        break;
      }
      case "set-media-feature": {
        if (!context.output) {
          issues.push({ severity: "error", code: "missing-output", path, message: "Output engine is required for output trigger actions." });
          break;
        }
        try {
          const state = context.output.getState(current.outputId);
          if (state.target.kind !== "media") {
            issues.push({ severity: "error", code: "invalid-output-action", path, message: `Output "${current.outputId}" is not a media output.` });
            break;
          }
        } catch (error) {
          issues.push({ severity: "error", code: "missing-output", path, message: error instanceof Error ? error.message : `Output "${current.outputId}" does not exist.` });
          break;
        }
        registerCommand({ key: `media-feature:${current.outputId}:${current.feature}`, path, description: `${current.feature.toUpperCase()} ${current.outputId}`, value: current.enabled });
        break;
      }
    }
  };

  visit(action, []);
  return { valid: issues.length === 0, issues };
}

export function assertValidTriggerAction(action: TriggerAction, context: TriggerContext): void {
  const result = validateTriggerAction(action, context);
  if (!result.valid) throw new Error(result.issues.map((issue) => issue.message).join(" "));
}
