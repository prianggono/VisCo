export interface OutputFrameSource {
  readonly compositionId: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly frameNumber: number;
}

export interface OutputFrame {
  readonly source: OutputFrameSource;
  readonly sceneId: string;
  readonly layerIds: readonly string[];
}

export interface OutputFrameConsumer {
  readonly id: string;
  consume(frame: OutputFrame): Promise<void>;
}
