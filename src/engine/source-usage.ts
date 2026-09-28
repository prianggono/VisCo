import type { Deck, DeckLayerRef } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import type { ProgramState } from "./program-engine.js";

export interface SourceLayerUsage {
  readonly deckId: string;
  readonly deckName: string;
  readonly layerId: string;
  readonly layerName: string;
  readonly groupIds: readonly string[];
  readonly groupNames: readonly string[];
}

export interface SourceProgramUsage {
  readonly compositionId: string;
  readonly deckId: string;
  readonly layerId: string;
  readonly layerName: string;
}

export interface SourceUsage {
  readonly layers: readonly SourceLayerUsage[];
  readonly program: readonly SourceProgramUsage[];
}

export interface SourceUsageGraph {
  readonly decks: readonly Deck[];
  readonly groups: readonly Group[];
  readonly programs?: readonly ProgramState[];
}

/** Finds every canonical Layer/Group and committed Program snapshot using a Source. */
export function findSourceUsage(sourceId: string, graph: SourceUsageGraph): SourceUsage {
  const groupsByDeckAndLayer = new Map<string, Group[]>();

  for (const group of graph.groups) {
    for (const layerId of group.layerIds) {
      const key = group.deckId + ":" + layerId;
      const groups = groupsByDeckAndLayer.get(key) ?? [];
      groups.push(group);
      groupsByDeckAndLayer.set(key, groups);
    }
  }

  const layers: SourceLayerUsage[] = [];

  for (const deck of graph.decks) {
    for (const layer of deck.layers) {
      if (layer.sourceId !== sourceId) continue;

      const groups = groupsByDeckAndLayer.get(deck.id + ":" + layer.id) ?? [];
      layers.push({
        deckId: deck.id,
        deckName: deck.name,
        layerId: layer.id,
        layerName: layer.name,
        groupIds: groups.map((group) => group.id),
        groupNames: groups.map((group) => group.name)
      });
    }
  }

  const program: SourceProgramUsage[] = [];

  for (const state of graph.programs ?? []) {
    for (const item of state.layers) {
      if (item.layer.sourceId !== sourceId) continue;
      program.push({
        compositionId: state.compositionId,
        deckId: item.source.deckId,
        layerId: item.source.layerId,
        layerName: item.layer.name
      });
    }
  }

  return { layers, program };
}

export function isLayerProgrammed(
  ref: DeckLayerRef,
  programs: readonly ProgramState[]
): boolean {
  return programs.some((program) =>
    program.layers.some((item) =>
      item.source.deckId === ref.deckId && item.source.layerId === ref.layerId
    )
  );
}
