export interface SliceTransform {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

export interface Slice {
  readonly id: string;
  readonly name: string;
  readonly transform: SliceTransform;
  readonly layerIds: readonly string[];
  readonly locked: boolean;
}
