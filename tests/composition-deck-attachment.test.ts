import { describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "../src/persistence/project.js";
import { attachDeckToComposition } from "../src/engine/composition-deck-attachment.js";
import { detachDeckFromComposition } from "../src/engine/composition-deck-detachment.js";
import { attachDeckToChannel } from "../src/engine/channel-deck-attachment.js";
import { detachDeckFromChannel } from "../src/engine/channel-deck-detachment.js";
import { attachSliceToComposition } from "../src/engine/composition-slice-attachment.js";
import { detachSliceFromComposition } from "../src/engine/composition-slice-detachment.js";
import { mapLayerToSlice } from "../src/engine/slice-layer-mapping.js";
import { unmapLayerFromSlice } from "../src/engine/slice-layer-unmapping.js";

const project: ProjectSnapshot = {
  version: 1,
  compositions: [
    {
      id: "composition-live",
      name: "Live",
      format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 },
      deckIds: ["deck-a"],
      sliceIds: ["slice-live"],
      locked: false
    },
    {
      id: "composition-other",
      name: "Other",
      format: { width: 1920, height: 1080, fps: 30, bitDepth: 8 },
      deckIds: [],
      sliceIds: [],
      locked: false
    }
  ],
  channels: [
    {
      id: "channel-offline",
      name: "Offline",
      type: "offline",
      deckIds: ["deck-a"],
      enabled: true
    }
  ],
  decks: [
    {
      id: "deck-a",
      name: "A",
      layers: [],
      transition: { type: "cut", durationMs: 0 }
    },
    {
      id: "deck-b",
      name: "B",
      layers: [
        { id: "layer-1", name: "B Layer 1", sourceId: "source-video" }
      ],
      transition: { type: "fade", durationMs: 500 }
    }
  ],
  groups: [],
  slices: [
    {
      id: "slice-live",
      name: "Main",
      transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
      layerRefs: [],
      locked: false
    }
  ],
  sources: [],
  outputs: [
    {
      id: "output-live",
      kind: "display",
      enabled: true,
      compositionId: "composition-live",
      deckId: "deck-a"
    }
  ],
  license: { state: "unlicensed", watermarkEnabled: true }
};

describe("Attach Deck to Composition", () => {
  it("appends a Deck by default without changing other presentation configuration", () => {
    const result = attachDeckToComposition(project, {
      compositionId: "composition-live",
      deckId: "deck-b"
    });

    expect(result.composition.deckIds).toEqual(["deck-a", "deck-b"]);
    expect(result.project.compositions[1].deckIds).toEqual([]);
    expect(result.project.channels).toEqual(project.channels);
    expect(result.project.outputs).toEqual(project.outputs);
    expect(result.project.slices).toEqual(project.slices);
    expect(project.compositions[0].deckIds).toEqual(["deck-a"]);
  });

  it("supports an explicit insertion index", () => {
    const result = attachDeckToComposition(project, {
      compositionId: "composition-live",
      deckId: "deck-b",
      index: 0
    });

    expect(result.composition.deckIds).toEqual(["deck-b", "deck-a"]);
  });

  it("rejects a duplicate Deck attachment", () => {
    expect(() =>
      attachDeckToComposition(project, {
        compositionId: "composition-live",
        deckId: "deck-a"
      })
    ).toThrow(
      'Deck "deck-a" is already attached to Composition "composition-live".'
    );
  });

  it("rejects a missing Composition", () => {
    expect(() =>
      attachDeckToComposition(project, {
        compositionId: "missing-composition",
        deckId: "deck-b"
      })
    ).toThrow(
      'Composition "missing-composition" does not exist in the project.'
    );
  });

  it("rejects a missing Deck", () => {
    expect(() =>
      attachDeckToComposition(project, {
        compositionId: "composition-live",
        deckId: "missing-deck"
      })
    ).toThrow('Deck "missing-deck" does not exist in the project.');
  });

  it("rejects attachment to a locked Composition", () => {
    const lockedProject: ProjectSnapshot = {
      ...project,
      compositions: project.compositions.map((composition) =>
        composition.id === "composition-live"
          ? { ...composition, locked: true }
          : composition
      )
    };

    expect(() =>
      attachDeckToComposition(lockedProject, {
        compositionId: "composition-live",
        deckId: "deck-b"
      })
    ).toThrow(
      'Composition "composition-live" is locked and cannot be changed.'
    );
  });

  it("rejects an invalid insertion index", () => {
    expect(() =>
      attachDeckToComposition(project, {
        compositionId: "composition-live",
        deckId: "deck-b",
        index: 99
      })
    ).toThrow(
      'Deck attachment index 99 is out of range for Composition "composition-live".'
    );
  });

  it("detaches an attached Deck without changing unrelated project state", () => {
    const attached = attachDeckToComposition(project, {
      compositionId: "composition-live",
      deckId: "deck-b"
    });

    const result = detachDeckFromComposition(attached.project, {
      compositionId: "composition-live",
      deckId: "deck-b"
    });

    expect(result.composition.deckIds).toEqual(["deck-a"]);
    expect(result.project.channels).toEqual(project.channels);
    expect(result.project.outputs).toEqual(project.outputs);
    expect(result.project.slices).toEqual(project.slices);
  });

  it("rejects detaching from a locked Composition", () => {
    const lockedProject: ProjectSnapshot = {
      ...project,
      compositions: project.compositions.map((composition) =>
        composition.id === "composition-live"
          ? { ...composition, locked: true }
          : composition
      )
    };

    expect(() =>
      detachDeckFromComposition(lockedProject, {
        compositionId: "composition-live",
        deckId: "deck-a"
      })
    ).toThrow(
      'Composition "composition-live" is locked and cannot be changed.'
    );
  });

  it("rejects detaching a Deck that is not attached", () => {
    expect(() =>
      detachDeckFromComposition(project, {
        compositionId: "composition-live",
        deckId: "deck-b"
      })
    ).toThrow(
      'Deck "deck-b" is not attached to Composition "composition-live".'
    );
  });

  it("rejects detaching a Deck still referenced by a Slice", () => {
    expect(() =>
      detachDeckFromComposition(project, {
        compositionId: "composition-live",
        deckId: "deck-a"
      })
    ).toThrow(
      'Deck "deck-a" cannot be detached because Slice "slice-live" still references it.'
    );
  });

  it("rejects detaching a Deck still targeted by an Output", () => {
    const noSliceProject: ProjectSnapshot = {
      ...project,
      slices: [],
      compositions: project.compositions.map((composition) =>
        composition.id === "composition-live"
          ? { ...composition, sliceIds: [] }
          : composition
      )
    };

    expect(() =>
      detachDeckFromComposition(noSliceProject, {
        compositionId: "composition-live",
        deckId: "deck-a"
      })
    ).toThrow(
      'Deck "deck-a" cannot be detached because Output "output-live" still targets it in Composition "composition-live".'
    );
  });

  it("attaches and detaches a Deck from a Channel without changing Composition or Output", () => {
    const attached = attachDeckToChannel(project, {
      channelId: "channel-offline",
      deckId: "deck-b"
    });

    expect(attached.channel.deckIds).toEqual(["deck-a", "deck-b"]);
    expect(attached.project.compositions).toEqual(project.compositions);
    expect(attached.project.outputs).toEqual(project.outputs);

    const detached = detachDeckFromChannel(attached.project, {
      channelId: "channel-offline",
      deckId: "deck-b"
    });

    expect(detached.channel.deckIds).toEqual(["deck-a"]);
    expect(detached.project.compositions).toEqual(project.compositions);
    expect(detached.project.outputs).toEqual(project.outputs);
  });

  it("supports explicit Channel insertion order", () => {
    const result = attachDeckToChannel(project, {
      channelId: "channel-offline",
      deckId: "deck-b",
      index: 0
    });

    expect(result.channel.deckIds).toEqual(["deck-b", "deck-a"]);
  });

  it("rejects duplicate Channel attachment", () => {
    expect(() =>
      attachDeckToChannel(project, {
        channelId: "channel-offline",
        deckId: "deck-a"
      })
    ).toThrow(
      'Deck "deck-a" is already attached to Channel "channel-offline".'
    );
  });

  it("rejects missing Channel or Deck", () => {
    expect(() =>
      attachDeckToChannel(project, {
        channelId: "missing-channel",
        deckId: "deck-b"
      })
    ).toThrow('Channel "missing-channel" does not exist in the project.');

    expect(() =>
      attachDeckToChannel(project, {
        channelId: "channel-offline",
        deckId: "missing-deck"
      })
    ).toThrow('Deck "missing-deck" does not exist in the project.');
  });

  it("rejects detaching an unassigned Deck", () => {
    expect(() =>
      detachDeckFromChannel(project, {
        channelId: "channel-offline",
        deckId: "deck-b"
      })
    ).toThrow(
      'Deck "deck-b" is not attached to Channel "channel-offline".'
    );
  });

  it("rejects an invalid Channel insertion index", () => {
    expect(() =>
      attachDeckToChannel(project, {
        channelId: "channel-offline",
        deckId: "deck-b",
        index: 99
      })
    ).toThrow(
      'Deck attachment index 99 is out of range for Channel "channel-offline".'
    );
  });

  it("attaches and detaches a Slice without changing its mapping", () => {
    const projectWithoutSliceMembership: ProjectSnapshot = {
      ...project,
      compositions: project.compositions.map((composition) =>
        composition.id === "composition-live"
          ? { ...composition, sliceIds: [] }
          : composition
      )
    };

    const attached = attachSliceToComposition(projectWithoutSliceMembership, {
      compositionId: "composition-live",
      sliceId: "slice-live"
    });

    expect(attached.composition.sliceIds).toEqual(["slice-live"]);
    expect(attached.project.slices).toEqual(project.slices);

    const detached = detachSliceFromComposition(attached.project, {
      compositionId: "composition-live",
      sliceId: "slice-live"
    });

    expect(detached.composition.sliceIds).toEqual([]);
    expect(detached.project.slices).toEqual(project.slices);
  });

  it("supports explicit Slice insertion order", () => {
    const projectWithoutSliceMembership: ProjectSnapshot = {
      ...project,
      compositions: project.compositions.map((composition) =>
        composition.id === "composition-live"
          ? { ...composition, sliceIds: [] }
          : composition
      )
    };

    const result = attachSliceToComposition(projectWithoutSliceMembership, {
      compositionId: "composition-live",
      sliceId: "slice-live",
      index: 0
    });

    expect(result.composition.sliceIds).toEqual(["slice-live"]);
  });

  it("rejects duplicate Slice attachment", () => {
    expect(() =>
      attachSliceToComposition(project, {
        compositionId: "composition-live",
        sliceId: "slice-live"
      })
    ).toThrow(
      'Slice "slice-live" is already attached to Composition "composition-live".'
    );
  });

  it("rejects missing Slice or Composition", () => {
    expect(() =>
      attachSliceToComposition(project, {
        compositionId: "missing-composition",
        sliceId: "slice-live"
      })
    ).toThrow(
      'Composition "missing-composition" does not exist in the project.'
    );

    expect(() =>
      attachSliceToComposition(project, {
        compositionId: "composition-live",
        sliceId: "missing-slice"
      })
    ).toThrow('Slice "missing-slice" does not exist in the project.');
  });

  it("rejects Slice membership changes on a locked Composition", () => {
    const lockedProject: ProjectSnapshot = {
      ...project,
      compositions: project.compositions.map((composition) =>
        composition.id === "composition-live"
          ? { ...composition, locked: true }
          : composition
      )
    };

    expect(() =>
      attachSliceToComposition(lockedProject, {
        compositionId: "composition-live",
        sliceId: "slice-live"
      })
    ).toThrow(
      'Composition "composition-live" is locked and cannot be changed.'
    );

    expect(() =>
      detachSliceFromComposition(lockedProject, {
        compositionId: "composition-live",
        sliceId: "slice-live"
      })
    ).toThrow(
      'Composition "composition-live" is locked and cannot be changed.'
    );
  });

  it("rejects detaching an unassigned Slice", () => {
    const projectWithoutSliceMembership: ProjectSnapshot = {
      ...project,
      compositions: project.compositions.map((composition) =>
        composition.id === "composition-live"
          ? { ...composition, sliceIds: [] }
          : composition
      )
    };

    expect(() =>
      detachSliceFromComposition(projectWithoutSliceMembership, {
        compositionId: "composition-live",
        sliceId: "slice-live"
      })
    ).toThrow(
      'Slice "slice-live" is not attached to Composition "composition-live".'
    );
  });

  it("maps and unmaps a Deck-scoped Layer reference", () => {
    const projectWithoutMapping: ProjectSnapshot = {
      ...project,
      slices: project.slices.map((slice) => ({
        ...slice,
        layerRefs: []
      }))
    };

    const mapped = mapLayerToSlice(projectWithoutMapping, {
      compositionId: "composition-live",
      sliceId: "slice-live",
      ref: { deckId: "deck-a", layerId: "layer-1" }
    });

    expect(mapped.slice.layerRefs).toEqual([
      { deckId: "deck-a", layerId: "layer-1" }
    ]);

    const unmapped = unmapLayerFromSlice(mapped.project, {
      compositionId: "composition-live",
      sliceId: "slice-live",
      ref: { deckId: "deck-a", layerId: "layer-1" }
    });

    expect(unmapped.slice.layerRefs).toEqual([]);
  });

  it("keeps identical local Layer IDs distinct by Deck", () => {
    const projectWithBothDecks: ProjectSnapshot = {
      ...project,
      compositions: project.compositions.map((composition) =>
        composition.id === "composition-live"
          ? { ...composition, deckIds: ["deck-a", "deck-b"] }
          : composition
      ),
      slices: project.slices.map((slice) => ({
        ...slice,
        layerRefs: []
      }))
    };

    const mappedA = mapLayerToSlice(projectWithBothDecks, {
      compositionId: "composition-live",
      sliceId: "slice-live",
      ref: { deckId: "deck-a", layerId: "layer-1" }
    });

    const mappedB = mapLayerToSlice(mappedA.project, {
      compositionId: "composition-live",
      sliceId: "slice-live",
      ref: { deckId: "deck-b", layerId: "layer-1" }
    });

    expect(mappedB.slice.layerRefs).toEqual([
      { deckId: "deck-a", layerId: "layer-1" },
      { deckId: "deck-b", layerId: "layer-1" }
    ]);
  });

  it("rejects mapping a Layer from a Deck not attached to the Composition", () => {
    const projectWithoutDeckB = {
      ...project,
      slices: project.slices.map((slice) => ({
        ...slice,
        layerRefs: []
      }))
    };

    expect(() =>
      mapLayerToSlice(projectWithoutDeckB, {
        compositionId: "composition-live",
        sliceId: "slice-live",
        ref: { deckId: "deck-b", layerId: "layer-1" }
      })
    ).toThrow(
      'Deck "deck-b" is not attached to Composition "composition-live".'
    );
  });

  it("rejects duplicate Layer mapping", () => {
    const projectWithoutMapping = {
      ...project,
      slices: project.slices.map((slice) => ({
        ...slice,
        layerRefs: []
      }))
    };

    const mapped = mapLayerToSlice(projectWithoutMapping, {
      compositionId: "composition-live",
      sliceId: "slice-live",
      ref: { deckId: "deck-a", layerId: "layer-1" }
    });

    expect(() =>
      mapLayerToSlice(mapped.project, {
        compositionId: "composition-live",
        sliceId: "slice-live",
        ref: { deckId: "deck-a", layerId: "layer-1" }
      })
    ).toThrow(
      'Layer "layer-1" in Deck "deck-a" is already mapped to Slice "slice-live".'
    );
  });

  it("rejects mapping to locked Composition or Slice", () => {
    const lockedCompositionProject = {
      ...project,
      slices: project.slices.map((slice) => ({
        ...slice,
        layerRefs: []
      })),
      compositions: project.compositions.map((composition) =>
        composition.id === "composition-live"
          ? { ...composition, locked: true }
          : composition
      )
    };

    expect(() =>
      mapLayerToSlice(lockedCompositionProject, {
        compositionId: "composition-live",
        sliceId: "slice-live",
        ref: { deckId: "deck-a", layerId: "layer-1" }
      })
    ).toThrow(
      'Composition "composition-live" is locked and cannot be changed.'
    );

    const lockedSliceProject = {
      ...project,
      slices: project.slices.map((slice) => ({
        ...slice,
        layerRefs: [],
        locked: true
      }))
    };

    expect(() =>
      mapLayerToSlice(lockedSliceProject, {
        compositionId: "composition-live",
        sliceId: "slice-live",
        ref: { deckId: "deck-a", layerId: "layer-1" }
      })
    ).toThrow('Slice "slice-live" is locked and cannot be changed.');
  });

  it("rejects unmapping an absent Layer reference", () => {
    expect(() =>
      unmapLayerFromSlice(project, {
        compositionId: "composition-live",
        sliceId: "slice-live",
        ref: { deckId: "deck-a", layerId: "missing-layer" }
      })
    ).toThrow(
      'Layer "missing-layer" in Deck "deck-a" is not mapped to Slice "slice-live".'
    );
  });

  it("rejects detaching from a missing Composition", () => {
    expect(() =>
      detachDeckFromComposition(project, {
        compositionId: "missing-composition",
        deckId: "deck-a"
      })
    ).toThrow(
      'Composition "missing-composition" does not exist in the project.'
    );
  });
});
