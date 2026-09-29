# VisCo Revision Status

This is the handoff checklist for future revisions.

## Architecture foundation

- [x] Source / Library canonical domain
- [x] Composition / Canvas domain
- [x] Deck / Layer domain
- [x] Group domain
- [x] Slice / Mapping domain
- [x] Master / VisCo VB audio boundary
- [x] Physical / Virtual Output boundary
- [x] Composition-scoped Program state
- [x] Composition-scoped Output targets
- [x] Deck M/A/V fields
- [x] M OFF blocks Program but Preview remains available
- [x] X deselect runtime action
- [x] Project snapshot includes Output and Scene configuration
- [x] Health Check model
- [x] Revision documentation

## Engine boundaries

- [x] Program owns transition execution through Deck
- [x] Trigger owns multi-action execution and validation
- [x] Output owns routing and output feature switches
- [x] Deck Runtime owns Preview/active state
- [x] Trigger validation checks references/action compatibility; duplicate/copy-pasted commands are allowed
- [x] Program output synchronization carries Composition scope
- [x] Stream/Record encoder settings can differ while sharing Media Composition
- [x] Output transport registry isolates failed transports
- [x] Resilient frame source isolates missing capture devices and supports manual retry
- [x] Media compatibility cache boundary
- [x] Control mapping boundary for Keyboard/MIDI/Mouse/Stream Deck
- [x] Slice Editor engine: Move/Pick + Pen, point editing and Bezier handles
- [x] Source playback and source validation contracts

## UI status

- [ ] Web UI fully converted from mock state to domain/engine adapters
- [x] Add Input modal converted to full Input Select workflow
- [ ] Properties fully connected to selected Source/Layer
- [ ] View/layout persistence connected to Project
- [ ] Real Output status connected to native Output transports
- [x] Device discovery contract and Source UI selection workflow
- [x] Slice Properties exposes Move/Pick and Pen/Edit tools

## Native/runtime status

- [ ] Real video/image/audio decode implementation
- [ ] USB Video Capture / NDI / OMT / IP camera native frame implementations
- [ ] D3D11 renderer implementation in Windows host
- [ ] Slice mapping render implementation in native renderer
- [x] HDMI display output native bridge contract
- [x] LED output transport locked to Art-Net and adapter contract added
- [ ] Virtual Out native implementation
- [ ] Stream encoder implementation
- [ ] Segmented recorder implementation
- [ ] Zoom audio/video integration
- [ ] Native MIDI/Shortcut runtime implementation
- [ ] Health checks against real devices/files
- [ ] Windows desktop packaging
- [ ] License verification/enforcement/watermark — intentionally postponed per PRI

## Audit rules

1. Keep 30 FPS as the default target.
2. Do not move native capture/render/protocol logic into React.
3. Do not duplicate Layer state inside Group or Slice.
4. One Production Scene may feed Record + Stream + Virtual Out from the shared Composition.
5. Physical HDMI displays remain separate from Art-Net LED transport.
6. Art-Net is the only LED transport currently selected; vendor-specific LED backends are not part of this revision.
7. Duplicate/copied Trigger commands remain allowed; only broken references/actions are rejected.
8. License work remains excluded while VisCo is in try-and-error.
9. Before a Supabase backup, audit GitHub state and record unresolved native implementation items instead of marking them complete.

## Current audit conclusion — 2026-09-29

Core domain/engine contracts are internally aligned across Source → Layer → Group → Composition → Program → Scene → Output Frame → Output Transport. The remaining unchecked runtime items are native Windows/backend implementations, not unresolved architecture choices.

The current repository has not been verified by a successful CI run after the latest direct commits; GitHub returned no workflow runs for the latest checked commit. Therefore this document does not claim build/test success.

Supabase is used as the VisCo history/decision backup. A backup should capture this audit conclusion, current decisions, unresolved native implementation queue, and the exact GitHub commit being backed up.


## Audit continuation — 2026-09-29 (runtime/UI pass)

- [x] Added canonical Layer audio state (volume/pan) and connected the Properties → Audio controls to Layer state.
- [x] Added functional Slice creation/reset from the selected Layer and connected rectangle geometry editing to Slice state.
- [x] Added regression coverage for output transport isolation, resilient frame-source recovery, media compatibility caching, control mappings, source playback, Art-Net boundaries, and HDMI display separation.
- [ ] Native Windows implementations remain pending: real media decode, capture/network frame acquisition, D3D11 rendering, native Slice mapping, Virtual Out, stream encoder, recorder, Zoom, MIDI/Shortcut runtime, real device/file health, and Windows packaging.
- [ ] Project file/UI view-layout persistence and the remaining Trigger/Advanced/Slice visual editor adapters still need the application-level wiring.
- [ ] License verification/enforcement/watermark remains intentionally excluded.
- CI is running for the latest runtime-contract test commit; completion is recorded only after GitHub reports the final result.


## Native runtime boundary pass — 2026-09-29

- [x] Hardened D3D11 runtime lifecycle and capability/frame validation.
- [x] Added Windows media output boundary for stream/record.
- [x] Added Virtual Output boundary using the shared OutputFrame/Scene composition.
- [x] Added Windows video runtime lifecycle for camera and USB capture.
- [x] Added native media decoder lifecycle boundary for Media Foundation/FFmpeg backends.
- [x] Added native network frame boundary covering NDI, OMT and IP Camera without protocol logic in React.
- [x] Added regression tests for all new native boundaries.
- [ ] Actual Windows-native host implementations still require the native host layer; the TypeScript boundaries deliberately do not fake GPU/device/protocol behavior.
- [ ] License work remains excluded.


## End-to-end audit pass — 2026-09-29

- [x] Added validated ProjectRuntime around ProjectSnapshot serialization/loading.
- [x] ProjectRuntime validates Composition/Deck/Group/Layer/Slice/Source/Scene references before replace/load.
- [x] Added collection-to-snapshot helper so Deck-contained Layers are persisted without creating duplicate Layer state.
- [x] Exposed OutputEngine target listing for persistence.
- [x] Added OutputFrame builder that binds Program + Scene + Composition format and validates dimensions/FPS/frame number.
- [x] Fixed Output compositor to select the active Program Layer from the composed Layer array instead of assigning the array to a single-layer field.
- [x] Added Scene Runtime regression coverage and Scene/Composition relationship validation coverage.
- [x] Added Trigger Engine regression coverage; duplicate/copied actions remain valid while broken references remain errors.
- [x] Added Library search/sort plus reference-aware removal guards.
- [x] Added regression coverage for safe Library removal.
- [ ] React UI still needs full application-level Save/Load Project wiring; the validated persistence engine is now ready for that adapter.
- [ ] Native Windows host implementations remain pending and are not simulated by TypeScript.
- [ ] CI success is not claimed: GitHub connector returned no workflow runs for the latest direct commit during this audit.
- [ ] License verification/enforcement/watermark remains intentionally excluded.


## Application wiring pass — 2026-09-29

- [x] React UI Save/Open project actions now use the canonical Project Snapshot serializer/parser.
- [x] Project Load synchronizes Decks, Slices and LibraryEngine state.
- [x] LibraryEngine supports atomic replace-all for project loading.
- [x] Trigger Engine now supports a validated Deck Master level action through DeckProgramController.
- [x] Trigger validation covers missing Deck and Master range.
- [x] Existing 30 FPS, Preview/Program, Scene, Slice, Output and native boundary decisions remain unchanged.
- [ ] Trigger property panel still needs a visual trigger editor; current UI placeholder is intentionally not replaced with fake persistence.
- [ ] Advanced Output UI still needs a complete Scene/Display/Production editor.
- [ ] Latest direct GitHub commit has no workflow run visible through the connector; CI PASS remains unverified.
