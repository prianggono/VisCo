import type { Composition } from "../domain/composition.js";
import type { Scene } from "../domain/scene.js";
import type { Slice } from "../domain/slice.js";
import type { ProgramState } from "./program-engine.js";
import { createOutputFrame } from "./output-frame-builder.js";
import { toD3D11RenderFrame } from "./d3d11-output-adapter.js";
import type { OutputFrame } from "./output-frame.js";
import type { D3D11RenderFrame } from "../native/d3d11-renderer.js";

/**
 * Deterministic Preview/Program -> Scene -> OutputFrame -> D3D11 boundary.
 * The native renderer remains responsible for actual GPU work.
 */
export class OutputPipeline {
  private frameNumber = 0;

  nextFrame(
    program: ProgramState,
    scene: Scene,
    composition: Composition,
    slices: readonly Slice[]
  ): OutputFrame {
    if (program.compositionId !== composition.id) {
      throw new Error(`Program belongs to composition "${program.compositionId}", not "${composition.id}".`);
    }
    const frame = createOutputFrame(
      program,
      scene,
      composition.format,
      this.frameNumber,
      slices
    );
    this.frameNumber += 1;
    return frame;
  }

  nextD3D11Frame(
    program: ProgramState,
    scene: Scene,
    composition: Composition,
    slices: readonly Slice[]
  ): D3D11RenderFrame {
    return toD3D11RenderFrame(this.nextFrame(program, scene, composition, slices));
  }

  resetFrameNumber(): void {
    this.frameNumber = 0;
  }

  getFrameNumber(): number {
    return this.frameNumber;
  }
}
