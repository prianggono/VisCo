export type AudioBus = "master" | "visco-vb";

export interface AudioRoute {
  readonly sourceId: string;
  readonly bus: AudioBus;
  readonly enabled: boolean;
}

/**
 * VisCo VB is intentionally isolated from Master.
 * VB -> Master must never be created by the routing engine.
 */
export function canRoute(sourceBus: AudioBus, targetBus: AudioBus): boolean {
  if (sourceBus === "visco-vb" && targetBus === "master") return false;
  return true;
}
