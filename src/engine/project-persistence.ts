import type { Composition } from "../domain/composition.js";
import type { Deck, DeckLayerRef } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import type { Layer } from "../domain/layer.js";
import type { Scene } from "../domain/scene.js";
import type { Slice } from "../domain/slice.js";
import type { Source } from "../domain/source.js";
import type { OutputTarget } from "../domain/output.js";

export interface ProjectSnapshot {
  readonly version: 1;
  readonly compositions: readonly Composition[];
  readonly decks: readonly Deck[];
  readonly groups: readonly Group[];
  readonly layers: readonly Layer[];
  readonly slices: readonly Slice[];
  readonly scenes: readonly Scene[];
  readonly sources: readonly Source[];
  readonly outputs: readonly OutputTarget[];
  readonly activeSceneIds?: Readonly<Record<string, string>>;
  readonly selectedCompositionId?: string;
  readonly programs?: Readonly<Record<string, DeckLayerRef | null>>;
  readonly deckPreviewLayerIds?: Readonly<Record<string, string | null>>;
  readonly deckActiveLayerIds?: Readonly<Record<string, string | null>>;
}

export type ProjectSnapshotInput = Omit<ProjectSnapshot, "version">;

export function createProjectSnapshot(input: ProjectSnapshotInput): ProjectSnapshot {
  return {
    version: 1,
    compositions: [...input.compositions],
    decks: [...input.decks],
    groups: [...input.groups],
    layers: [...input.layers],
    slices: [...input.slices],
    scenes: [...input.scenes],
    sources: [...input.sources],
    outputs: [...input.outputs],
    activeSceneIds: input.activeSceneIds ? { ...input.activeSceneIds } : undefined,
    selectedCompositionId: input.selectedCompositionId,
    programs: input.programs ? { ...input.programs } : undefined,
    deckPreviewLayerIds: input.deckPreviewLayerIds ? { ...input.deckPreviewLayerIds } : undefined,
    deckActiveLayerIds: input.deckActiveLayerIds ? { ...input.deckActiveLayerIds } : undefined
  };
}

export function serializeProject(snapshot: ProjectSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseProject(serialized: string): ProjectSnapshot {
  const parsed: unknown = JSON.parse(serialized);
  if (!parsed || typeof parsed !== "object" || (parsed as { version?: unknown }).version !== 1) {
    throw new Error("Unsupported VisCo project snapshot version.");
  }
  const value = parsed as Partial<ProjectSnapshot>;
  const collections: Array<keyof ProjectSnapshot> = ["compositions", "decks", "groups", "layers", "slices", "scenes", "sources", "outputs"];
  for (const key of collections) {
    if (!Array.isArray(value[key])) throw new Error(`Invalid VisCo project snapshot: "${key}" must be an array.`);
  }

  // Migrate the pre-canonical Slice relationship where Layer/Slice could both
  // carry duplicate relationship state. Slice.layerRefs is now authoritative.
  const decks = value.decks as readonly Deck[];
  const migratedSlices = (value.slices as readonly unknown[]).map((entry) => {
    const raw = entry as Record<string, unknown>;
    const existingRefs = Array.isArray(raw.layerRefs) ? raw.layerRefs : null;
    const legacyLayerIds = Array.isArray(raw.layerIds) ? raw.layerIds.filter((id): id is string => typeof id === "string") : [];
    const layerRefs = existingRefs
      ? existingRefs.filter((ref): ref is { deckId: string; layerId: string } =>
          Boolean(ref) && typeof ref === "object" &&
          typeof (ref as { deckId?: unknown }).deckId === "string" &&
          typeof (ref as { layerId?: unknown }).layerId === "string")
      : legacyLayerIds.flatMap((layerId) => {
          const deck = decks.find((candidate) => candidate.layers.some((layer) => layer.id === layerId));
          return deck ? [{ deckId: deck.id, layerId }] : [];
        });
    const { layerIds: _legacyLayerIds, ...slice } = raw;
    return { ...slice, layerRefs };
  });

  const migratedDecks = (value.decks as readonly unknown[]).map((entry) => {
    const raw = entry as Record<string, unknown>;
    const { compositionId: _legacyCompositionId, ...deck } = raw;
    return deck;
  });

  const migratedLayers = (value.layers as readonly unknown[]).map((entry) => {
    const raw = entry as Record<string, unknown>;
    const { sliceIds: _legacySliceIds, ...layer } = raw;
    return layer;
  });

  return {
    version: 1,
    compositions: value.compositions!,
    decks: migratedDecks as unknown as readonly Deck[],
    groups: value.groups!,
    layers: migratedLayers as unknown as readonly Layer[],
    slices: migratedSlices as unknown as readonly Slice[],
    scenes: value.scenes!,
    sources: value.sources!,
    outputs: value.outputs!,
    activeSceneIds: value.activeSceneIds && typeof value.activeSceneIds === "object" ? value.activeSceneIds as Record<string, string> : undefined,
    selectedCompositionId: typeof value.selectedCompositionId === "string" ? value.selectedCompositionId : undefined,
    programs: value.programs && typeof value.programs === "object" ? value.programs as Record<string, DeckLayerRef | null> : undefined,
    deckPreviewLayerIds: value.deckPreviewLayerIds && typeof value.deckPreviewLayerIds === "object" ? value.deckPreviewLayerIds as Record<string, string | null> : undefined,
    deckActiveLayerIds: value.deckActiveLayerIds && typeof value.deckActiveLayerIds === "object" ? value.deckActiveLayerIds as Record<string, string | null> : undefined
  };
}
