import type { DeckLayerRef } from "../domain/deck.js";
import type { ProgramState } from "./program-engine.js";

export type OutputKind = "display" | "stream" | "record";

export interface OutputTarget {
  readonly id: string;
  readonly kind: OutputKind;
  readonly enabled: boolean;
  readonly deckId?: string;
}

export interface OutputState {
  readonly target: OutputTarget;
  readonly source: DeckLayerRef | null;
  readonly active: boolean;
}

export class OutputEngine {
  private readonly targets = new Map<string, OutputTarget>();
  private readonly states = new Map<string, OutputState>();

  register(target: OutputTarget): void {
    if (this.targets.has(target.id)) throw new Error(`Output "${target.id}" is already registered.`);
    this.targets.set(target.id, target);
    this.states.set(target.id, { target, source: null, active: false });
  }

  setEnabled(targetId: string, enabled: boolean): OutputState {
    const target = this.requireTarget(targetId);
    const updated = { ...target, enabled };
    this.targets.set(targetId, updated);
    const state = { ...this.requireState(targetId), target: updated, active: enabled && this.requireState(targetId).active };
    this.states.set(targetId, state);
    return state;
  }

  setDeckTarget(targetId: string, deckId: string | undefined): OutputTarget {
    const target = this.requireTarget(targetId);
    const updated: OutputTarget = deckId === undefined
      ? { id: target.id, kind: target.kind, enabled: target.enabled }
      : { ...target, deckId };
    this.targets.set(targetId, updated);
    this.states.set(targetId, { ...this.requireState(targetId), target: updated });
    return updated;
  }

  route(targetId: string, program: ProgramState): OutputState {
    const target = this.requireTarget(targetId);
    if (!target.enabled) throw new Error(`Output "${target.id}" is disabled.`);
    const state = { target, source: program.source, active: true };
    this.states.set(targetId, state);
    return state;
  }

  routeMany(targetIds: readonly string[], program: ProgramState): readonly OutputState[] {
    return targetIds.map((targetId) => this.route(targetId, program));
  }

  routeDeck(targetId: string, deckId: string, source: DeckLayerRef): OutputState {
    const target = this.requireTarget(targetId);
    if (!target.enabled) throw new Error(`Output "${target.id}" is disabled.`);
    if (target.deckId !== deckId) {
      throw new Error(`Output "${target.id}" targets deck "${target.deckId ?? "Program"}", not "${deckId}".`);
    }
    const state = { target, source, active: true };
    this.states.set(targetId, state);
    return state;
  }

  syncFromProgram(program: ProgramState): readonly OutputState[] {
    const ids = [...this.states.values()]
      .filter((s) => s.active && s.target.enabled && s.target.deckId === undefined)
      .map((s) => s.target.id);
    return this.routeMany(ids, program);
  }

  syncFromDeck(deckId: string, source: DeckLayerRef): readonly OutputState[] {
    const ids = [...this.states.values()]
      .filter((s) => s.active && s.target.enabled && s.target.deckId === deckId)
      .map((s) => s.target.id);
    return ids.map((id) => this.routeDeck(id, deckId, source));
  }

  stop(targetId: string): OutputState {
    const state = { ...this.requireState(targetId), active: false };
    this.states.set(targetId, state);
    return state;
  }

  getState(targetId: string): OutputState { return this.requireState(targetId); }

  getActiveStates(): readonly OutputState[] {
    return [...this.states.values()].filter((s) => s.active);
  }

  private requireTarget(targetId: string): OutputTarget {
    const target = this.targets.get(targetId);
    if (!target) throw new Error(`Output "${targetId}" does not exist.`);
    return target;
  }

  private requireState(targetId: string): OutputState {
    const state = this.states.get(targetId);
    if (!state) throw new Error(`Output "${targetId}" does not exist.`);
    return state;
  }
}
