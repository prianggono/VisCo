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

## Current audit conclusion — superseded

The earlier conclusion that CI was unverified is no longer current. The latest baseline commit was validated by GitHub Actions before the current audit pass.


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


## Native frame path implementation — 2026-09-30

- [x] Added native Windows NDI runtime loading with dynamic SDK binding.
- [x] Added native Windows OMT runtime loading with dynamic libomt binding.
- [x] Added NDI source discovery endpoint through the native host.
- [x] Added OMT source discovery endpoint through the native host.
- [x] Added NDI/OMT receive loops producing the canonical BGRA `NativeVideoFrame`.
- [x] Connected the network `NativeVideoFrame` path directly into the existing D3D11 renderer.
- [x] Added environment-controlled startup: `VISCO_NETWORK_PROTOCOL` + `VISCO_NETWORK_SOURCE`.
- [x] Added native HTTP controls: `/network/discover`, `/network/start`, `/network/stop`, `/network/status`.
- [x] Preserved 30 FPS host pacing and offline-safe fallback to local Media Foundation capture.
- [ ] ASIO driver callback binding is still SDK/driver dependent and is not faked.
- [ ] D3D11 multi-layer Composition/Slice GPU compositing is still separate from the single-frame native acquisition path.
- [ ] Native Record/Stream/Virtual Output sinks still need to consume the same rendered GPU frame.
- [ ] Native end-to-end Preview/Program control from the TypeScript application into the Windows host still needs the desktop transport bridge.
- [ ] This change has not yet been validated by a completed Windows GitHub Actions run.


## Native output path implementation — 2026-09-30

- [x] Added native Media Foundation H.264 recording sink from the host frame path.
- [x] Added native Virtual Output using a named Windows shared-memory frame surface with a stable header + BGRA payload.
- [x] Added native NDI Stream sender through dynamic NDI SDK loading.
- [x] Added native OMT Stream sender through dynamic libomt loading.
- [x] Record + Virtual + Stream can be enabled independently through environment configuration.
- [x] Output submission is fed from the same native frame selected for the D3D11 host in this runtime pass.
- [ ] The final Composition/Slice GPU frame is not yet the source of these sinks; they currently consume the acquired native BGRA frame.
- [ ] ASIO callback -> Audio Engine remains the next SDK-dependent native audio step.


## Full A-T audit pass — 2026-10-01

- [x] A — Object ownership audit: Composition → Deck → Group → Layer → Slice → Scene references reviewed; validator now rejects orphan/multiply-owned Deck/Group/Slice objects and orphan persisted Layers.
- [x] B — Composition lifecycle: create/activate/delete rules reviewed; deletion cleans Composition-owned Group/Slice/Scene state and refuses locked/non-empty compositions.
- [x] C — Deck lifecycle: create/clone/delete/move membership reviewed; Composition membership remains the owner.
- [x] D — Group lifecycle: create/clone/delete/member operations reviewed; active Composition membership guards are enforced.
- [x] E — Layer lifecycle: source attachment, duplicate/delete/reorder and runtime cleanup reviewed.
- [x] F — Slice lifecycle: Composition-scoped editor and Layer references reviewed; cross-Composition editing is rejected.
- [x] G — Scene lifecycle: Composition-scoped activation/deletion reviewed.
- [x] H — Library/Source lifecycle: add/duplicate/relink/remove/reference guards reviewed.
- [x] I — UI state vs application state: remaining default-Composition coupling in Program/Output UI paths removed.
- [x] J — Composition navigation: activation now clears stale Layer/Scene selection when the target Composition has no members.
- [x] K — Persistence: Project snapshot builder no longer rewrites the default Composition to contain every Deck/Slice; persisted Composition membership remains authoritative.
- [x] L — Command/mutation boundary: no new duplicate owner introduced; UI mutations continue to call canonical engines where they already exist.
- [x] M — Trigger/Program/Transition: Trigger Scene lookup and Program state are now Composition-scoped in the UI adapter.
- [x] N — Preview/Program: Program monitor now reads the active Composition state.
- [x] O — Output: media/physical routing UI paths now use the active Composition instead of hard-coded default state.
- [x] P — Performance: 30 FPS remains the default target; no 60 FPS default introduced.
- [x] Q — UI/UX smoke: existing smoke coverage retained; Composition-scoped state changes are covered by the new audit path.
- [x] R — Regression: relationship validation expanded to catch orphan and multiply-owned objects.
- [x] S — CI: latest baseline CI and Native Windows CI were both successful before this audit; new commits will trigger the same pipelines.
- [x] T — Native/backend boundary: native code remains outside React; this pass fixes UI/state contracts without faking native SDK behavior.

### Remaining implementation items intentionally not marked complete

- [ ] Real multi-layer Composition/Slice GPU compositing into the native frame pipeline.
- [ ] Final rendered GPU frame feeding native Record/Stream/Virtual sinks.
- [ ] Native ASIO callback integration.
- [ ] Full native Preview/Program desktop transport bridge.
- [ ] Windows packaging/EXE installer and update/recovery workflow.
- [ ] License verification/enforcement/watermark remains intentionally postponed.


## Deployment verification — 2026-10-01

- Current audited source is main at commit 3bc431abfdc1e2e206ee0ef9a98d7fccab6b3109.
- The existing Vercel visco-web production deployment predates this source and is not the current audited UI.
- This marker exists to trigger a fresh Vercel Git deployment when the project is connected to the repository.
