export interface CompositionFormat {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly bitDepth: 8 | 10;
}

export interface Composition {
  readonly id: string;
  readonly name: string;
  readonly format: CompositionFormat;
  readonly deckIds: readonly string[];
  readonly groupIds: readonly string[];
  readonly sliceIds: readonly string[];
  readonly locked: boolean;
}
