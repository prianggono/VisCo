import type { DeckLayerRef } from "../domain/deck.js";
import type { ProgramState } from "./program-engine.js";
import { compositeProgram, type CompositedLayer } from "./compositor.js";

export interface CompositedOutput {
  readonly source: DeckLayerRef;
  readonly compositionId: string;
  /** Canonical multi-Layer Program render result. */
  readonly layers: readonly CompositedLayer[];
}

/**
 * Bridges Program composition data to an output renderer.
 * Output routing remains owned by OutputEngine; Transform remains owned by Layer.
 *
 * This compatibility bridge intentionally does not collapse a multi-Layer
 * Program into the first Layer.
 */
export function compositeProgramForOutput(program: ProgramState): CompositedOutput | null {
  if (!program.source) return null;
  const layers = compositeProgram(program);
  if (!layers.length) return null;

  return {
    source: program.source,
    compositionId: program.compositionId,
    layers
  };
}
