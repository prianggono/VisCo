import type { DeckLayerRef } from "../domain/deck.js";
import type { ProgramState } from "./program-engine.js";

export type OutputKind = "led" | "stream" | "record";

export interface OutputTarget {
  readonly id: string;
  readonly kind: OutputKind;
  readonly enabled: boolean;
}

export interface OutputState {
  readonly target: OutputTarget;
  readonly source: DeckLayerRef | null;
  readonly active: boolean;
}

export interface OutputDriver {
  start(target: OutputTarget, state: ProgramState): OutputState;
  stop(target: OutputTarget, state: ProgramState): OutputState;
}

export class OutputEngine {
  private readonly targets = new Map<string, OutputTarget>();
  private readonly states = new Map<string, OutputState>();

  register(target: OutputTarget): void {
    if (this.targets.has(target.id)) {
      throw new Error(`Output "${target.id}" is already registered.`);
    }
    this.targets.set(target.id, target);
    this.states.set(target.id, { target, source: null, active: false });
  }

  setEnabled(targetId: string, enabled: boolean): OutputState {
    const target = this.requireTarget(targetId);
    const updated = { ...target, enabled };
    this.targets.set(targetId, updated);

    const current = this.requireState(targetId);
    const state = { ...current, target: updated, active: enabled && current.active };
    this.states.set(targetId, state);
    return state;
  }

  route(targetId: string, program: ProgramState): OutputState {
    const target = this.requireTarget(targetId);
    if (!target.enabled) {
      throw new Error(`Output "${target.id}" is disabled.`);
    }

    const state: OutputState = { target, source: program.source, active: true };
    this.states.set(targetId, state);
    return state;
  }

  routeMany(targetIds: readonly string[], program: ProgramState): readonly OutputState[] {
    return targetIds.map((targetId) => this.route(targetId, program));
  }

  syncFromProgram(program: ProgramState): readonly OutputState[] {
    const activeIds = [...this.states.values()]
      .filter((state) => state.active && state.target.enabled)
      .map((state) => state.target.id);

    return this.routeMany(activeIds, program);
  }

  stop(targetId: string): OutputState {
    const current = this.requireState(targetId);
    const state = { ...current, active: false };
    this.states.set(targetId, state);
    return state;
  }

  getState(targetId: string): OutputState {
    return this.requireState(targetId);
  }

  getActiveStates(): readonly OutputState[] {
    return [...this.states.values()].filter((state) => state.active);
  }

  private requireTarget(targetId: string): OutputTarget {
    const target = this.targets.get(targetId);
    if (!target) {
      throw new Error(`Output "${targetId}" does not exist.`);
    }
    return target;
  }

  private requireState(targetId: string): OutputState {
    const state = this.states.get(targetId);
    if (!state) {
      throw new Error(`Output "${targetId}" does not exist.`);
    }
    return state;
  }
}
