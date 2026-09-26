# VisCo Revision Guide

Use this before every revision.

## 1. Identify the owner

- Source/Library -> `src/domain/source.ts`
- Layer -> `src/domain/layer.ts`
- Deck/Transition -> `src/domain/deck.ts`
- Group -> `src/domain/group.ts`
- Composition/Canvas -> `src/domain/composition.ts`
- Slice/Mapping -> `src/domain/slice.ts`
- Audio routing -> `src/domain/audio.ts`
- Output definitions -> `src/domain/output.ts`
- Program -> `src/engine/program-engine.ts`
- Deck runtime -> `src/engine/deck-runtime.ts`
- Trigger -> `src/engine/trigger-engine.ts` and `trigger-validator.ts`
- Health Check -> `src/engine/health-check.ts`
- License/watermark -> `src/domain/license.ts` and future `src/engine/license-engine.ts`
- Project/revision -> `src/persistence/`
- UI presentation -> `src/web/` and `src/ui/`

## 2. Do not duplicate

If a feature already has an owner, do not add another implementation to Properties, Settings, Output Bar, or another engine.

Examples:
- Output settings stay in Output.
- Shortcut configuration stays in Settings -> Shortcut.
- Playlist editor stays in List/Properties.
- Transition stays in Deck.
- Composition is Canvas, not a second media container.
- Stream/Record encoders are independent but consume the same Media Composition.
- VisCo VB is not Master.

## 3. Change order

Domain -> Engine -> Tests -> UI adapter -> UI.

Never make UI state the source of truth for an engine feature.

## 4. Runtime vs editable state

Undo/Redo and Revision History cover editable project configuration.

They do not undo:
- Program/Preview runtime actions
- Stream/Record start-stop
- M/A/V movement
- device connection changes
- output emergency actions
- trigger execution

## 5. License policy

VisCo has no package tiers in this design.

- Unlicensed: application remains usable and output contains VisCo watermark.
- Licensed: watermark is removed.
- Licensing must not be implemented by disabling individual feature packages.

## 6. Audio safety

The routing engine must reject:

`VisCo VB -> Master`

`Master -> VisCo VB` is permitted only as an explicit operator route; it must not be automatically created by the system.

## 7. Output safety

Physical Output and Virtual Out are separate.

- Venue Composition -> Physical Output.
- Media Composition -> Virtual Out -> Stream/Record/Zoom.
- No automatic fallback to Windows Primary Monitor.
- Hardware replacement requires operator assignment.

## 8. When a requirement changes

Update:
1. The canonical owner.
2. The relevant test.
3. This revision map if ownership changes.
4. The UI only after the engine model is correct.
