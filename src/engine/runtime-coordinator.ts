import type { Composition } from "../domain/composition.js";
import type { Slice } from "../domain/slice.js";
import type { Scene } from "../domain/scene.js";
import type { ProgramState } from "./program-engine.js";
import { FrameClock } from "./frame-clock.js";
import { OutputPipeline } from "./output-pipeline.js";
import type { D3D11RenderFrame, D3D11RendererRuntime } from "../native/d3d11-renderer.js";
import { OutputFrameBus } from "./output-frame-bus.js";

export interface RuntimeCoordinatorConfig { readonly fps?: number; }
export interface RuntimeCoordinatorSnapshot {
  readonly running: boolean;
  readonly frameNumber: number;
  readonly renderedFrames: number;
  readonly failedFrames: number;
}

export class RuntimeCoordinator {
  private readonly clock: FrameClock;
  private readonly pipeline = new OutputPipeline();
  private readonly outputBus = new OutputFrameBus();
  private running = false;
  private renderedFrames = 0;
  private failedFrames = 0;
  private lastFrame: D3D11RenderFrame | null = null;
  private context: { program: ProgramState; scene: Scene; composition: Composition; slices: readonly Slice[] } | null = null;

  constructor(private readonly renderer: D3D11RendererRuntime, config: RuntimeCoordinatorConfig = {}) {
    this.clock = new FrameClock({ fps: config.fps ?? 30, maxPending: 1 });
  }

  setContext(program: ProgramState, scene: Scene, composition: Composition, slices: readonly Slice[]): void {
    this.context = { program, scene, composition, slices };
  }

  async start(): Promise<void> {
    if (this.running) return;
    await this.renderer.initialize();
    this.running = true;
    this.clock.start(async (frameNumber) => {
      const context = this.context;
      if (!context) return;
      try {
        const outputFrame = this.pipeline.nextFrame(context.program, context.scene, context.composition, context.slices);
        await this.outputBus.publish(outputFrame);
        const frame = { ...outputFrame, width: outputFrame.source.width, height: outputFrame.source.height, fps: outputFrame.source.fps, layerIds: outputFrame.layerIds, slices: outputFrame.slices } as D3D11RenderFrame;
        this.lastFrame = { ...frame, frameNumber } as D3D11RenderFrame & { frameNumber?: number };
        await this.renderer.render(frame);
        this.renderedFrames += 1;
      } catch {
        this.failedFrames += 1;
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.clock.stop();
    await this.renderer.flush();
    await this.renderer.dispose();
    this.running = false;
  }

  subscribeOutput(subscriber: import("./output-frame-bus.js").OutputFrameSubscriber): void { this.outputBus.subscribe(subscriber); }
  unsubscribeOutput(id: string): void { this.outputBus.unsubscribe(id); }
  getOutputBusStats(): import("./output-frame-bus.js").OutputFrameBusStats { return this.outputBus.getStats(); }

  getLastFrame(): D3D11RenderFrame | null { return this.lastFrame; }
  getStats(): RuntimeCoordinatorSnapshot {
    return { running: this.running, frameNumber: this.clock.getStats().frameNumber, renderedFrames: this.renderedFrames, failedFrames: this.failedFrames };
  }
}
