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
- [x] Project snapshot includes Output and License configuration
- [x] License watermark policy
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

## UI status

- [ ] Web UI fully converted from mock state to domain/engine adapters
- [x] Add Input modal converted to full Input Select workflow
- [ ] Properties connected to selected Source/Layer
- [ ] View/layout persistence connected to Project
- [ ] Real Output status connected to Output Engine
- [x] Device discovery contract and Source UI selection workflow (NDI / OMT / IP Camera / Camera / Desktop Capture)

## Runtime engines still planned

- [ ] Real video/image/audio decode
- [ ] USB Video Capture / NDI / OMT / IP camera
- [ ] Composition renderer
- [ ] Slice mapping renderer
- [ ] Physical display / LED output
- [ ] Virtual Out
- [ ] Stream encoder
- [ ] Segmented recorder
- [ ] Zoom audio/video integration
- [ ] MIDI / Shortcut runtime
- [ ] Health checks against real devices/files
- [ ] License verification and watermark renderer — intentionally postponed per PRI
- [ ] Windows desktop packaging

## Rule for the next revision

Do not implement an unchecked item in the UI first. Add or update the owning domain/engine contract, add tests, then connect the UI adapter.

No feature package tiers are planned. Unlicensed mode remains usable with a watermark; licensed mode removes the watermark.


## Current runtime handoff

The Source UI now owns selection flow and delegates device discovery to the canonical DeviceDiscoveryEngine. Camera/Webcam and USB Video Capture discovery are native Windows responsibilities. NDI, OMT, Desktop Capture, Display, and LED discovery are intentionally native-provider responsibilities; the UI does not duplicate protocol or Windows device logic.

OMT discovery supports an optional Discovery Server field. OMT documents DNS-SD as the normal discovery mechanism and a TCP Discovery Server as the multicast-unavailable fallback; the default Discovery Server port documented by OMT is 6399.

The next implementation step is the Windows native provider/frame bridge. Do not move native capture or frame conversion into the React UI.


### Input clarification — USB Video Capture

The live inputs include **Camera / Webcam** and **Video Capture** as separate device classes. Camera/Webcam covers built-in or USB cameras; Video Capture covers USB-connected HDMI/SDI/video capture devices. Discovery and frame acquisition are native Windows responsibilities; the React UI must not use browser camera enumeration for this input. The native device metadata should preserve backend/device capabilities so the future Windows adapter can expose resolution, pixel format, FPS, audio presence, and vendor/device identity.


## Decision gates — do not implement before explicit agreement

Only the following architecture choices are currently blocked on a decision:

1. **Renderer backend** — D3D11 is locked. Native implementation remains pending.
2. **Native media/capture backend** — locked: Media Foundation primary decode, FFmpeg compatibility fallback, DirectShow capture fallback, and native professional capture boundary.
3. **LED output architecture** — define the native transport/driver boundary for LED controllers and mapping outputs before implementing real LED output.
4. **Real output transport details** — physical display / Virtual Out / stream / recorder backend choices are downstream of the renderer/media decisions.
5. **License enforcement timing** — explicitly postponed. Do not implement enforcement or licensing tiers while the project is still in try-and-error. Watermark policy remains only as a domain contract.

Everything else can be audited, tested, documented, or implemented without waiting for those decisions.

## Autonomous work queue

The next work should proceed without asking for a decision:

- [x] Verify Program Layer Snapshot invariants and add regression tests.
- [x] Finish Layering contract at the engine level: deterministic layer ordering and blend metadata for multi-layer composition, without selecting a GPU backend.
- [x] Audit Program → Deck transition → Output synchronization and composition-scoped output sync.
- [x] Audit Trigger validation/execution; duplicate commands intentionally allowed.
- [x] Audit Audio routing ownership; canonical Audio In → VisCo VB → Record/Stream/Zoom path remains centralized.
- [ ] Audit Properties panels and classify each control as connected, partial, mock, or missing.
- [x] Audit persistence coverage; snapshot now covers Composition/Deck/Group/Layer/Slice/Scene/Source/Output.
- [x] Audit Health Check contracts; generic ID/reference/output checks added without native binding.
- [ ] Keep Camera/Webcam and USB Video Capture separated as canonical source classes.
- [ ] Keep NDI and OMT as first-class source/device contracts.
- [ ] Run regression/CI after every implementation batch.

## Working rule

When an item can be completed safely from the existing architecture, implement it directly. When an item changes a foundational technology choice or native backend, stop at the decision gate and ask PRI before coding it.


## Audit continuation — #4 onward

- [x] #4 Transform canonical state: Layer.transform is the single transform source.
- [x] #5 Multi-layer ordering contract: deterministic Layer.order with stable insertion tie-breaker; Group remains organizational and does not duplicate Layer state.
- [x] #6 Slice mapping contract: Slice remains composition-owned and references Layer IDs; mapping supports rectangle, corner-pin, Bezier, polygon, crop/scale, rotation and grid/snap metadata.
- [x] Scene contract: Scene is an output mapping/routing preset. Physical displays use display Scenes; Record + Stream + External/Virtual Out share one production Scene.
- [x] #7 Real compositor integration contract: Program carries immutable multi-layer snapshot and compositor emits deterministic render metadata.
- [ ] #8 Native D3D11 renderer implementation: bridge contract added; Windows host implementation remains.
- [ ] Scene runtime adapter: Scene validation/runtime routing remains to be implemented.
- [ ] Native output transport implementation remains downstream of the D3D11/media decisions.


### Audit batch — 2026-09-29

- [x] Program snapshot preserves all Deck Layers while retaining the selected Layer as UI/trigger focus.
- [x] Multi-layer compositor consumes Program snapshot and emits deterministic render order plus blend/transform metadata.
- [x] D3D11 native renderer boundary defined without leaking Windows APIs into React/domain code.
- [x] Media pipeline boundary defined: Media Foundation → FFmpeg compatibility; DirectShow/professional capture fallback boundary.
- [x] Trigger duplicate/copy-paste restriction removed per operator workflow; reference validation remains.
- [x] Trigger output synchronization corrected to use Program composition scope.
- [x] Project snapshot serialization covers current core domain objects including Scene.
