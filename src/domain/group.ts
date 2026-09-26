export interface Group {
  readonly id: string;
  readonly name: string;
  readonly layerIds: readonly string[];
  readonly collapsed: boolean;
}
