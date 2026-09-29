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
