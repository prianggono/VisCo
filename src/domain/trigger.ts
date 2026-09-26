export type TriggerAction =
  | { readonly type: "program-layer"; readonly deckId: string; readonly layerId: string }
  | { readonly type: "column"; readonly deckId: string; readonly column: number; readonly enabled: boolean }
  | { readonly type: "master"; readonly deckId: string; readonly enabled: boolean }
  | { readonly type: "audio-level"; readonly deckId: string; readonly level: number }
  | { readonly type: "visual-level"; readonly deckId: string; readonly level: number }
  | { readonly type: "output"; readonly targetId: string; readonly enabled: boolean }
  | { readonly type: "media-feature"; readonly targetId: string; readonly feature: "stream" | "record" | "virtual"; readonly enabled: boolean };

export interface Trigger {
  readonly id: string;
  readonly name: string;
  readonly actions: readonly TriggerAction[];
}

export interface TriggerValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateTrigger(trigger: Trigger): TriggerValidationResult {
  const errors: string[] = [];
  const exact = new Set<string>();
  const targetStates = new Map<string, string>();

  for (const action of trigger.actions) {
    const signature = JSON.stringify(action);
    if (exact.has(signature)) {
      errors.push(`Duplicate action: ${signature}`);
      continue;
    }
    exact.add(signature);

    const target = getTargetKey(action);
    const state = getStateKey(action);
    const previous = targetStates.get(target);

    if (previous !== undefined && previous !== state) {
      errors.push(`Conflicting actions for ${target}.`);
    } else {
      targetStates.set(target, state);
    }

    if (action.type === "column" && (!Number.isInteger(action.column) || action.column < 1)) {
      errors.push(`Invalid column for ${target}.`);
    }
    if ((action.type === "audio-level" || action.type === "visual-level") &&
        (action.level < 0 || action.level > 100)) {
      errors.push(`Invalid level for ${target}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function getTargetKey(action: TriggerAction): string {
  switch (action.type) {
    case "program-layer": return `deck:${action.deckId}:layer:${action.layerId}:program`;
    case "column": return `deck:${action.deckId}:column:${action.column}`;
    case "master": return `deck:${action.deckId}:master`;
    case "audio-level": return `deck:${action.deckId}:audio`;
    case "visual-level": return `deck:${action.deckId}:visual`;
    case "output": return `output:${action.targetId}`;
    case "media-feature": return `output:${action.targetId}:feature:${action.feature}`;
  }
}

function getStateKey(action: TriggerAction): string {
  switch (action.type) {
    case "program-layer": return action.layerId;
    case "column": return String(action.enabled);
    case "master": return String(action.enabled);
    case "audio-level": return String(action.level);
    case "visual-level": return String(action.level);
    case "output": return String(action.enabled);
    case "media-feature": return String(action.enabled);
  }
}
