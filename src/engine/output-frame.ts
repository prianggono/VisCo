export interface OutputFrameSource {
  readonly compositionId: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly frameNumber: number;
}

export interface OutputFrameSlice {
  readonly id: string;
  readonly layerIds: readonly string[];
  readonly transform: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly rotation: number;
    readonly scaleX?: number;
    readonly scaleY?: number;
    readonly cropLeft?: number;
    readonly cropTop?: number;
    readonly cropRight?: number;
    readonly cropBottom?: number;
  };
  readonly mapping?: {
    readonly mode: "rectangle" | "corner-pin" | "bezier" | "polygon";
    readonly points?: readonly { readonly x: number; readonly y: number }[];
  };
}

export interface OutputFrame {
  readonly source: OutputFrameSource;
  readonly sceneId: string;
  readonly layerIds: readonly string[];
  /** Immutable mapping data carried to the renderer; Slice remains the source of truth. */
  readonly slices: readonly OutputFrameSlice[];
}

export interface OutputFrameConsumer {
  readonly id: string;
  consume(frame: OutputFrame): Promise<void>;
}
