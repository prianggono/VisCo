export type SceneTargetKind = "display" | "production";

export interface SceneDisplayTarget {
  readonly kind: "display";
  readonly displayId: string;
}

export interface SceneProductionTarget {
  readonly kind: "production";
  readonly record: boolean;
  readonly stream: boolean;
  readonly virtual: boolean;
}

export type SceneTarget = SceneDisplayTarget | SceneProductionTarget;

/**
 * A Scene is an output mapping/routing preset, not a render hierarchy.
 * One production Scene may feed Record, Stream and External/Virtual Out together.
 */
export interface Scene {
  readonly id: string;
  readonly name: string;
  readonly compositionId: string;
  readonly target: SceneTarget;
  readonly enabled: boolean;
}
