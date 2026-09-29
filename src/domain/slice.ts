export type SliceMappingMode = "rectangle" | "corner-pin" | "bezier" | "polygon";

export interface SlicePoint {
  readonly x: number;
  readonly y: number;
}

export interface SliceTransform {
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
}

export interface SliceMapping {
  readonly mode: SliceMappingMode;
  readonly points?: readonly SlicePoint[];
  readonly snapToGrid?: boolean;
  readonly gridSize?: number;
}

export interface Slice {
  readonly id: string;
  readonly name: string;
  readonly transform: SliceTransform;
  readonly mapping?: SliceMapping;
  readonly locked: boolean;
}
