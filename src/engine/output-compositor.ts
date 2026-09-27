import type { DeckLayerRef } from "../domain/deck.js";
import type { ProgramState } from "./program-engine.js";
import { compositeProgram, type CompositedLayer } from "./compositor.js";

export interface CompositedOutput {
  readonly source: DeckLayerRef;
  readonly compositionId: string;
  readonly layer: CompositedLayer;
}

/**
 * Bridges Program composition data to an output renderer.
 * Output routing remains owned by OutputEngine; Transform remains owned by Layer.
 */
export function compositeProgramForOutput(program: ProgramState): CompositedOutput | null {
  if (!program.source) return null;
  const layer = compositeProgram(program);
  if (!layer) return null;

  return {
    source: program.source,
    compositionId: program.compositionId,
    layer
  };
}
