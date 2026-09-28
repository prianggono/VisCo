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
- [x] Trigger validation blocks duplicate/conflicting actions before execution
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
- [ ] License verification and watermark renderer
- [ ] Windows desktop packaging

## Rule for the next revision

Do not implement an unchecked item in the UI first. Add or update the owning domain/engine contract, add tests, then connect the UI adapter.

No feature package tiers are planned. Unlicensed mode remains usable with a watermark; licensed mode removes the watermark.


## Current runtime handoff

The Source UI now owns selection flow and delegates device discovery to the canonical DeviceDiscoveryEngine. Browser camera enumeration is supported where the browser exposes media devices. NDI, OMT, Desktop Capture, Display, and LED discovery are intentionally native-provider responsibilities; the UI does not duplicate protocol or Windows device logic.

OMT discovery supports an optional Discovery Server field. OMT documents DNS-SD as the normal discovery mechanism and a TCP Discovery Server as the multicast-unavailable fallback; the default Discovery Server port documented by OMT is 6399.

The next implementation step is the Windows native provider/frame bridge. Do not move native capture or frame conversion into the React UI.


### Input clarification — USB Video Capture

The live camera input is defined as **Video Capture**, not generic webcam Camera. The intended hardware is USB-connected video capture hardware such as USB HDMI/SDI capture devices. Discovery and frame acquisition are native Windows responsibilities; the React UI must not use browser camera enumeration for this input. The native device metadata should preserve backend/device capabilities so the future Windows adapter can expose resolution, pixel format, FPS, audio presence, and vendor/device identity.
