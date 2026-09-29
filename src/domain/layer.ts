import type { Source } from "./source.js";
import type { TriggerAction } from "./trigger.js";

export interface LayerTransform {
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
  /** When true, changing one scale axis updates the other proportionally. */
  readonly scaleLinked?: boolean;
  readonly rotation: number;
  readonly opacity: number;
}

export interface LayerPlayback {
  readonly playing: boolean;
  readonly loop: boolean;
  readonly speed: number;
}

export interface LayerAudio {
  readonly volume: number;
  readonly pan: number;
}

export interface Layer {
  readonly id: string;
  readonly name: string;
  readonly sourceId?: Source["id"] | null;
  readonly transform?: LayerTransform;
  readonly playback?: LayerPlayback;
  readonly audio?: LayerAudio;
  readonly blendMode?: string;
  readonly order?: number;
  /** Trigger actions are persisted with the Layer; duplicate/copy actions are allowed. */
  readonly triggers?: readonly TriggerAction[];
}
