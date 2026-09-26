# VisCo Architecture & Revision Map

## Purpose
This document is the canonical map for VisCo. Every future revision must change the smallest owning module and must not duplicate an existing function in another module.

## Canonical ownership

| Area | Canonical module | Notes |
|---|---|---|
| Source / Library | domain/source.ts | A Source is reusable input/media/internal source. Library stores Source references. |
| Composition / Canvas | domain/composition.ts | Canvas and composition-level configuration. |
| Deck | domain/deck.ts | Deck owns Layers, M/A/V, Transition, Loop and Deck output targeting. M OFF excludes the Deck from Program. |
| Layer instance | domain/layer.ts | A Layer references a Source and may reference multiple Slices. |
| Group | domain/group.ts | Collection/organization of Layers. |
| Slice / Mapping | domain/slice.ts | Slice is a canvas/output region; Layer↔Slice is many-to-many. |
| Audio routing | domain/audio.ts | Audio In -> VisCo VB -> Record/Stream/Zoom is the canonical external path. Monitoring is diagnostic only and is not part of the signal path. Master is a separate internal audio bus. |
| Output | domain/output.ts | Physical Output and Virtual Out are distinct paths. |
| Trigger | engine/trigger-engine.ts | Multi-action execution and validation. |
| Program | engine/program-engine.ts | Program state and Deck transition execution. |
| Deck runtime | engine/deck-runtime.ts | Preview/active Layer runtime state. |
| Persistence | persistence/ | Project, autosave, revision snapshots and recovery metadata. |
| Health Check | engine/health-check.ts | Device/media/output health diagnostics. |
| License | domain/license.ts + engine/license-engine.ts | Free/unlicensed mode uses watermark; no package tiers are defined. |
| Web UI | web/ + ui/ | UI is an adapter/presentation layer; business rules stay in domain/engine. |

## Output model

Venue:
Composition -> Decks -> Physical Output (LED/TV/display)

Media:
Composition -> Decks -> Virtual Out -> Stream / Record / Zoom

Stream and Record may have independent encoder settings while sharing the same Media Composition. Output targets are composition-scoped; a Deck may provide the explicit override.

## Audio model

Master:
VisCo Audio -> Master -> Sound Card OUT -> Mixer

External audio:
Sound Card IN -> Audio In -> VisCo VB -> Zoom / Stream / Record

Monitoring:
Signal state is observed at the input/VB/destination points for diagnostics only; monitoring never becomes an audio routing destination.

Internal audio:
VisCo Audio Deck -> Master remains a separate internal audio mix.

Forbidden:
Master -> VisCo VB
VisCo VB -> Master

## Interaction rules

- Layer name click = Preview.
- Layer box click = Program immediately.
- No normal Take action.
- Transition belongs to Deck.
- M/A/V belong to Deck.
- Output target is selected by Deck, never by Layer.
- Program state is Composition-scoped; Venue and Media may run independently.
- M/A/V are Deck-level controls; M OFF prevents Program while Preview remains possible.
- X deselects the active Deck layer without clearing Preview.
- Source is reusable; Layer is the instance.
- Composition is Canvas, not a media bundle.
- Group is a collection of Layers.
- Slice is a region where a Layer works.
- Layer and Slice are many-to-many.
- Output settings are not duplicated in Properties.
- Shortcut settings are canonical in Settings -> Shortcut.

## Revision rule

Before changing a feature:
1. Find its canonical owner in this map.
2. Change the owner.
3. Update its tests.
4. Update UI adapters only if the presentation needs changing.
5. Do not create a second implementation elsewhere.

## Revision index

- R001: Deck/Layer/Program foundation
- R002: Trigger validation
- R003: Output routing
- R004: Source/Library model
- R005: Composition/Group/Slice model
- R006: Audio In/VB/Record-Stream-Zoom routing
- R007: Physical/Virtual Output split
- R008: Project persistence + revision history
- R009: Health Check
- R010: License + watermark
- R011: Real media/capture engines
- R012: Performance/GPU/hardware integration

The index is a planning map, not a promise that every subsystem is already implemented.
