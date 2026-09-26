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
- [ ] Add Input modal converted to full Input Select workflow
- [ ] Properties connected to selected Source/Layer
- [ ] View/layout persistence connected to Project
- [ ] Real Output status connected to Output Engine

## Runtime engines still planned

- [ ] Real video/image/audio decode
- [ ] Camera / capture / NDI / IP camera
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
