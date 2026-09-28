export type ControlInputKind = "keyboard" | "midi" | "mouse" | "stream-deck";

export interface ControlInput {
  readonly kind: ControlInputKind;
  readonly code: string;
  readonly value?: number;
}

export interface ControlBinding {
  readonly id: string;
  readonly input: ControlInput;
  readonly action: import("./trigger-engine.js").TriggerAction;
  readonly enabled: boolean;
}

export class ControlMappingEngine {
  private readonly bindings = new Map<string, ControlBinding>();

  register(binding: ControlBinding): void {
    if (!binding.id.trim()) throw new Error("Control binding id is required.");
    if (this.bindings.has(binding.id)) throw new Error(`Control binding "${binding.id}" is already registered.`);
    if (!binding.input.code.trim()) throw new Error("Control input code is required.");
    this.bindings.set(binding.id, binding);
  }

  setEnabled(bindingId: string, enabled: boolean): ControlBinding {
    const binding = this.require(bindingId);
    const updated = { ...binding, enabled };
    this.bindings.set(bindingId, updated);
    return updated;
  }

  match(input: ControlInput): readonly ControlBinding[] {
    return [...this.bindings.values()].filter(
      (binding) =>
        binding.enabled &&
        binding.input.kind === input.kind &&
        binding.input.code === input.code
    );
  }

  list(): readonly ControlBinding[] {
    return [...this.bindings.values()];
  }

  remove(bindingId: string): void {
    this.bindings.delete(bindingId);
  }

  private require(bindingId: string): ControlBinding {
    const binding = this.bindings.get(bindingId);
    if (!binding) throw new Error(`Control binding "${bindingId}" does not exist.`);
    return binding;
  }
}
