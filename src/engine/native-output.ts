import type { CompositionFormat } from "../domain/composition.js";
import type { RenderedCompositionLayer } from "./composition-renderer.js";

export type NativeOutputProtocol =
  | "display"
  | "led"
  | "stream"
  | "record"
  | "virtual-video";

export type NativeOutputStatus =
  | "unavailable"
  | "stopped"
  | "starting"
  | "running"
  | "error";

export interface NativeOutputFrame {
  readonly timestamp: number;
  readonly format: CompositionFormat;
  readonly layers: readonly RenderedCompositionLayer[];
}

export interface NativeOutputState {
  readonly outputId: string;
  readonly protocol: NativeOutputProtocol;
  readonly status: NativeOutputStatus;
  readonly deviceId?: string;
  readonly error?: string;
}

export interface NativeOutputDescriptor {
  readonly outputId: string;
  readonly protocol: NativeOutputProtocol;
  readonly name: string;
  readonly deviceId?: string;
  readonly compositionId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface NativeOutputBridge {
  getState(outputId: string): Promise<NativeOutputState>;
  start(output: NativeOutputDescriptor): Promise<NativeOutputState>;
  pushFrame(outputId: string, frame: NativeOutputFrame): Promise<void>;
  stop(outputId: string): Promise<NativeOutputState>;
  refresh(outputId?: string): Promise<readonly NativeOutputState[]>;
}

export class UnavailableNativeOutputBridge implements NativeOutputBridge {
  private readonly states = new Map<string, NativeOutputState>();

  async getState(outputId: string): Promise<NativeOutputState> {
    return this.states.get(outputId) ?? {
      outputId,
      protocol: "display",
      status: "unavailable",
      error: "Windows native output backend is not installed."
    };
  }

  async start(output: NativeOutputDescriptor): Promise<NativeOutputState> {
    const state: NativeOutputState = {
      outputId: output.outputId,
      protocol: output.protocol,
      status: "unavailable",
      ...(output.deviceId ? { deviceId: output.deviceId } : {}),
      error: "Windows native output backend is not installed."
    };
    this.states.set(output.outputId, state);
    return state;
  }

  async pushFrame(outputId: string, _frame: NativeOutputFrame): Promise<void> {
    const state = await this.getState(outputId);
    if (state.status !== "running") {
      throw new Error(state.error ?? `Output "${outputId}" is not running.`);
    }
  }

  async stop(outputId: string): Promise<NativeOutputState> {
    const state = await this.getState(outputId);
    const stopped: NativeOutputState = { ...state, status: "unavailable" };
    this.states.set(outputId, stopped);
    return stopped;
  }

  async refresh(outputId?: string): Promise<readonly NativeOutputState[]> {
    if (outputId) return [await this.getState(outputId)];
    return [...this.states.values()];
  }
}
