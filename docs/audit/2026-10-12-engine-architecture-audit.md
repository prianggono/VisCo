# VisCo Technical Audit — 2026-10-12

## Scope and safety

This is a source-level audit of the GitHub files accessible during this session. A dedicated branch, `audit/engine-migration-2026-10-12`, was created from `main`; all changes described here remain isolated from `main`. One narrow native fallback-selection correction was made on this branch after the source audit; it is not yet validated by a successful Windows build.

Latest commit found by repository commit search: `e14181dbd3e3bd97ad7979d46fe33533aa9c6ca9` (`test(ui): cover Program Deck reclaim after X`, 2026-10-07). Branches found: `main` and `feat/real-media-rendering`. The commit's combined status returned no status entries and the workflow-run query returned no runs; this is **unknown/unverified**, not a passing CI result.

## Agreed delivery boundary (2026-10-12)

Work only through these three gates:
1. Stabilize the foundation: web/unit/type checks and native Windows build must pass.
2. Connect and validate the engine: prove UI Deck/Layer/Program state reaches the native render path and output routing without duplicate/fallback layers.
3. Validate the UI: Playwright smoke/E2E must pass for Preview/Program, Deck switching/reclaim, Group, Slice, and output controls; resolve real product bugs rather than weakening assertions.

**Stop after the UI is validated. Do not begin EXE packaging, installer work, release preparation, or broader OBS/libobs migration until the user explicitly authorizes the next phase.** Keep all work isolated from `main` until checks are green.

## Latest validation results — 2026-10-12

Validated on isolated audit branch commit `0e1822354acbb169945c77f56f16dd48e9bb152f`:
- **VisCo CI:** passed (unit tests, typecheck, production web build).
- **Native Windows CI:** passed (CMake configure and Release build on Windows runner).
- **VisCo UI Smoke:** passed, **7/7 Playwright tests** including Preview/Program, Deck switching/reclaim, Group, Slice, physical display selection, and output settings.
- UI test fixes use the actual seeded source names and actual Display Output Settings UI; assertions were not removed or weakened.
- The native UI bridge sends render-source bindings and render-layer plans to the Windows host; native main loop resolves frame references, renders the composition, and submits the resulting frame to the output runtime. This confirms the code path is connected at source/build level, not a claim of physical-hardware validation.
- **Still unverified on event hardware:** real camera/NDI/OMT ingestion, physical display/LED output, encoder/stream/record output, audio fan-out, and sustained frame pacing. Those are runtime acceptance checks, not reasons to start EXE packaging now.

## 1. Engine and dependency audit

### Web application
- `package.json`: React 19, Vite 7, TypeScript 5.9, Vitest 3, Playwright 1.55.
- Scripts: `npm test`, `npm run build`, `npm run typecheck`. There is no native build script.
- `.github/workflows/ci.yml` installs Node 20 and runs `npm install`, `npm test`, `npm run typecheck`, and `npm run build` on Ubuntu. It does not configure MSVC/Windows SDK or invoke CMake.
- Separate workflows already exist: `.github/workflows/ui-smoke.yml` runs Playwright and `.github/workflows/native-windows.yml` configures/builds the CMake host on Windows. The initial audit missed these because only `ci.yml` had been inspected first; do not duplicate those jobs in the core workflow.
- `vite.config.ts` excludes `tests/ui-smoke.test.ts` from Vitest; the Playwright smoke/E2E file therefore needs a separate runner/server step. The checked-in workflow does not run that Playwright file.
- `tsconfig.app.json` has strict TypeScript and includes `src`.

### Native Windows host
- `native/WindowsHost/CMakeLists.txt` builds a C++20 Windows executable and links Windows multimedia, D3D11, DXGI, Media Foundation, WASAPI, Winsock and related system libraries.
- Native files include Media Foundation capture, D3D11 rendering, NDI/OMT dynamic-library probes, network frame receive, recording/virtual/stream output, ASIO driver discovery/callback support, audio mixer, source registry, and a loopback HTTP control server.
- These files prove that implementation exists, not that the end-to-end behavior has passed a Windows build or hardware test.
- The native host currently auto-starts the first discovered camera, optionally a network source from environment variables, and output modes from environment variables. This is not yet evidence of robust device selection/recovery or of UI-controlled production routing.

## 2. Architecture audit

### Documented contract
`README.md` defines Deck-owned Layers and Transition; selecting a Layer name is Preview-only; clicking a Layer box programs it; Trigger executes Actions but does not own Transition; output routing is by Deck; Stream, Record and Virtual Out share a render source/resolution/FPS; display output is separate from the media-output pipeline.

### Source-level evidence and gaps
- `native/WindowsHost/main.cpp` obtains render-layer snapshots from the native HTTP control server, refreshes frame references through `SourceRegistry`, calls `D3D11Host::renderComposition` or `render`, and submits the resulting frame to `NativeOutputRuntime`.
- The source registry and native renderer are present, but the retrieved files do not establish that the web app's Deck/Layer/Program state is authoritatively and completely synchronized into that native render plan. This UI-to-native contract needs an integration test.
- In the baseline `main.cpp`, fallback selection was structured as `if (compositionLayers.empty() && network.running()) { ... } else if (capture source exists) { append capture layer; }`. When a non-empty composition existed, the `else if` could append the capture frame as an unintended additional layer. This was corrected on the audit branch by nesting network/capture fallback selection under `if (compositionLayers.empty())`; a Windows build and runtime regression test are still required.
- The main loop calls `Sleep(33)` after frame processing. This limits cadence to approximately 30 fps or less (render/processing time is added to the sleep); it does not guarantee a stable 30 fps. Measure actual frame pacing and dropped frames before tuning.
- The ASIO engine and mixer are instantiated and passed into the control server. The retrieved main loop does not visibly call `AudioMixer::process`; inspect the complete callback/control path before claiming a live mixer-to-output bus. Current source shows ASIO ingestion/mixer statistics and gain control, but the agreed external-audio-to-record/stream/Zoom fan-out is not yet proven end-to-end.
- Runtime adapter probing only establishes that a DLL loads and expected exported symbols are found in relevant adapters; it does not prove protocol interoperability, SDK ABI compatibility, or stable streaming.

### Documentation conflict
The README's Development section says desktop UI, media decoding/rendering, capture, display discovery, streaming, recording, virtual output and hardware acceleration are not implemented, while the current repository contains UI tests and multiple native runtime components. Update the README only after runtime/test evidence is established, so implementation presence is not mistaken for production readiness.

## 3. Migration matrix

| Area | Current evidence | Decision |
|---|---|---|
| VisCo UI and operator workflow | React/Vite UI; Playwright scenarios cover Preview, Program, Deck, Group, Slice and output controls | Preserve; VisCo remains the primary workflow and UI |
| Deck / Layer / Program / Trigger / Transition | README contract and UI tests exist; native synchronization needs proof | Preserve as VisCo-owned domain model; define and test one explicit UI-to-engine state contract |
| Native capture / D3D11 renderer / display | C++ components exist; hardware run not verified | Keep as baseline during audit; validate before replacing |
| Stream / Record / Virtual Out | Output runtime exists; NDI/OMT use optional runtime libraries | Preserve behind adapters; verify each protocol and independent ON/OFF state |
| Audio / ASIO / WASAPI | Driver discovery, ASIO engine and mixer code exist; full fan-out not proven | Audit callback, buffering, device selection and bus destinations before integration |
| OBS / libobs | Not established as integrated in the inspected source | Prototype behind an adapter; do not wrap OBS or replace VisCo workflow |
| Legacy/duplicate routing | Potential capture fallback behavior identified; broader duplicate state not fully audited | Trace all call paths and add regression tests before deleting any legacy code |

## 4. libobs migration and compatibility gates

Use OBS/libobs as a candidate engine component, not as a wholesale replacement of VisCo. First prototype source ingestion, scene/composition rendering, audio routing, encoder/record/stream output, and device recovery behind a narrow adapter. Keep VisCo responsible for Deck, Layer, Preview/Program, Trigger, Transition, output policy, and operator UX.

Before distribution, review the exact libobs version and all linked plugins/dependencies for GPL-2.0-or-later and other license obligations. Do not assume that dynamic linking automatically removes license obligations. Compare multi-display/LED output, independent output routing, performance, and recovery against the native baseline. Do not remove the existing runtime until parity tests pass.

## 5. Remaining runtime acceptance gates

1. **Passed in CI:** web unit tests, typecheck, and production build.
2. **Passed in CI:** Playwright UI suite, 7/7 tests; browser-only optional-host connection refusal remains the only suppressed startup network error.
3. **Passed in CI:** Windows/MSVC CMake configure and Release build. Running the native host with physical devices is still pending.
4. Integration: prove UI Deck/Layer state reaches the native render plan; Preview does not alter Program; Program transitions are Deck-owned; Trigger sequences do not duplicate routing; output overrides are Deck-level.
5. Media: test capture → frame registry → composition renderer → physical display; then each of Stream, Record and Virtual Out independently and together at target 30 fps.
6. Audio: test ASIO/WASAPI device discovery, callback stability, clipping/underruns, gain, and external-audio fan-out to every agreed destination.
7. Resilience/performance: repeated source changes, missing SDK/DLL, device unplug/reconnect, crash recovery, and measured frame pacing/CPU/GPU/memory on target hardware.

## Changes made on the isolated audit branch

- Corrected native fallback selection so the capture source is not appended to a non-empty render composition.
- Added `npm run typecheck` to `.github/workflows/ci.yml`. Existing dedicated workflows already cover Playwright UI smoke/E2E and the Windows/MSVC CMake build, so the redundant duplicate jobs were removed.
- Added this audit report and opened draft PR #1. `main` has not been modified.

## Current disposition

- Latest confirmed commit `0e1822354acbb169945c77f56f16dd48e9bb152f`: core CI, Native Windows CI, and UI Smoke all passed; UI Smoke reported 7/7 tests.
- The native fallback correction is covered by a successful Windows build, but still needs an actual-host runtime regression test.
- UI validation is green. Keep the remaining work limited to engine/runtime acceptance and do not start EXE packaging, installer work, or broad OBS/libobs migration until explicitly authorized.

## Engine integration follow-up — 2026-10-13

A focused source trace of the native Windows host identified concrete blockers beyond the green UI/build checks:

- **Audio mixer is not consumed by the main render/output loop.** `AudioMixer::process` pulls ASIO samples, applies master gain, clamps samples, and counts underruns, but `native/WindowsHost/main.cpp` contains no call to `audioMixer.process(...)`. The HTTP control server exposes ASIO/mixer control and status, but that alone does not create an audio destination. Do not claim ASIO → master bus → recording/stream/Zoom fan-out is connected.
- **Output runtime currently proves video output paths only.** `NativeOutputRuntime::submit` accepts a `NativeVideoFrame` and sends video to Media Foundation recording, shared-memory virtual output, and NDI/OMT video senders. The inspected interfaces do not accept mixed audio samples; video recording/streaming must not be described as including audio.
- **Frame pacing is capped by a fixed sleep, not a deadline scheduler.** The main loop submits a frame and then calls `Sleep(33)`; render and output processing time is added to that sleep, so actual cadence can be below 30 FPS. It is not evidence of stable 30 FPS.
- **Render source binding is metadata + registry lookup.** The bridge serializes layer IDs/source IDs/transforms and the native loop refreshes frames by source ID. If a layer's source cannot be resolved, its frame may remain null; the inspected code does not establish a visible integration failure signal for that layer. This needs an integration test and explicit error/diagnostic handling.

### Disposition of this follow-up

These are source-audit findings, not successful runtime tests. The next safe code task is to add focused integration/unit coverage and design the missing audio-output contract before implementing any audio fan-out. Do not simply call `AudioMixer::process` and discard the samples: that would consume the ASIO ring buffer without routing sound anywhere. Keep EXE packaging, installer/release work, and broad OBS/libobs migration out of scope.

## Source registry follow-up — 2026-10-13

Further inspection of `SourceRegistry` and the `/render/bind` / `/render/layers` handlers found two additional integration risks:

- `/render/bind` accepts any non-empty native source ID and responds `ok:true` after calling `bindAlias`; it does not validate that the requested native producer is supported or currently available. A successful HTTP response therefore means only that alias metadata was stored.
- `SourceRegistry::remove(sourceId)` erases only the direct frame entry. It does not clear alias entries that were populated from that source, so an alias can retain the last shared frame after its native source is removed. No current caller of `remove` was confirmed in this trace, so treat this as a lifecycle correctness risk to cover with tests, not as a reproduced production failure.
- `/render/layers` resolves the frame when the request arrives, and the render loop tries to refresh it from the registry. When the source ID is invalid or unresolved, the endpoint still stores the layer and reports success. The UI therefore needs a distinguishable source-resolution status instead of treating a successful metadata write as proof that pixels are available.

### Next implementation gate

Before connecting more runtime components, add native unit tests for alias binding, publish/update, source removal, unresolved source IDs, and frame refresh across repeated layer updates. Then change the bind/layer endpoints to report validation errors explicitly and expose unresolved-source diagnostics. Keep changes isolated on the audit branch and run the Windows CI before considering the gate complete. Audio routing and frame pacing remain separate blockers; no EXE packaging in this phase.


## Updated execution record — 2026-10-14

This section supersedes older status statements above where they conflict with newer code and CI evidence.

### Gate 1 — video engine and output trace

The current branch now uses a monotonic std::chrono::steady_clock deadline in native/WindowsHost/main.cpp instead of sleeping 33 ms after each rendered frame. The loop schedules at 30 FPS and resets a stale deadline when it falls more than one frame behind. This removes the fixed-sleep accumulation problem at source level; **it does not prove sustained 30 FPS on event hardware**.

The traced video path is:
1. The HTTP bridge accepts render-layer descriptors and resolves logical source IDs through SourceRegistry.
2. The main loop refreshes each layer's frame from the registry.
3. The D3D11 renderer renders the composition (or the single fallback frame when no composition layers are configured).
4. NativeOutputRuntime::submit(frame, frameNumber) sends the resulting video frame to the configured Media Foundation record writer, shared-memory virtual output, and/or NDI/OMT sender.

The fallback behavior is guarded by compositionLayers.empty(), preventing the automatic camera/network fallback from being appended to a non-empty user composition. Remaining gap: a successful layer-plan HTTP response and a successful build do not prove the selected source is publishing pixels or that a physical output is displaying them. The /render/layers response exposes ready and unresolvedSources; runtime-level UI-to-native contract coverage and hardware acceptance are still required.

### Gate 2 — audio integration contract

Current source evidence:
- ASIO callback ingestion writes audio frames to AudioEngine.
- AudioMixer::process(outputInterleaved, frames) pulls those frames, applies master gain, clamps samples and zero-fills underruns; the native CTest suite exercises the mixer.
- The HTTP server exposes ASIO status and mixer gain/status.
- **The production main loop does not call AudioMixer::process, and NativeOutputRuntime accepts only video frames.** Therefore, no complete master-bus-to-record/stream audio route currently exists in the inspected code.

Required integration contract before implementing fan-out:
1. Define a timestamped, sample-rate/channel-aware mixed-audio packet (48 kHz stereo as the current mixer default) and explicit ownership/lifetime rules for its sample buffer.
2. Keep audio acquisition/mixing on a real-time-safe path; do not perform blocking encoding, network sends, or allocation-heavy work inside the ASIO callback.
3. Give each output adapter an explicit audio capability/status. Media Foundation recording needs a synchronized audio stream and sample timestamps; NDI/OMT need their respective audio-frame APIs/runtime support. Shared-memory virtual output needs a documented audio contract or must be labelled video-only.
4. Use a bounded queue between mixing and output consumers, define underrun/overflow policy and counters, and keep video/audio timestamps aligned. One destination must not consume samples before another destination can read them.
5. Add deterministic tests for sample timing, gain/clipping, underrun/overflow, independent output enable/disable, and multi-destination fan-out before claiming end-to-end audio.

Do not call the mixer and discard its samples: that would drain the ASIO ring buffer without producing audible or recorded output. Do not report recording/streaming as audio-capable until the destination-specific path and tests exist.

### Gate 3 — runtime/hardware acceptance

This repository/CI session cannot physically validate the user's cameras, ASIO device, NDI/OMT peers, LED processor, or output displays. These are explicitly **not tested**, not failed and not passed. On target hardware, record evidence for:
- Camera selection, stop/start, unplug/reconnect and actual frames reaching Preview/Program.
- NDI and OMT receive/send independently, only when their compatible runtime/SDK is installed.
- Display selection and physical LED/display output; confirm the intended composition appears without an extra fallback layer.
- Recording playback and stream receiver checks; inspect errors and actual frame rate rather than relying only on HTTP ok responses.
- Measured render/output cadence over a sustained run, dropped/late frames, CPU/GPU/memory and recovery after source loss.
- Audio loopback, callback stability, gain, clipping, underrun/overflow, and each required destination after audio integration is implemented.

### Gate 4 — UI

The latest UI Smoke workflow passed on commit 1f89747b737be2c99f4652f52a019250eb7445ef. That is a green automated UI regression result, not physical-runtime validation. UI redesign/fixes remain sequenced after the engine/output and audio contract gates, per the agreed workflow. Do not weaken assertions to force a green result.

### Gate 5 — delivery boundary

Keep all work on audit/engine-migration-2026-10-12; keep PR #1 as draft; do not merge to main. Do not begin EXE packaging, installer, release preparation, licensing work, or broad OBS/libobs migration. Stop after engine/runtime acceptance and UI validation, then report the evidence and remaining hardware-only checks before asking for the next phase.


## Execution update — 2026-10-14

The audit branch has progressed beyond the initial snapshot above. The latest confirmed pre-change baseline was commit `5a65990b2d441775429dd0b160d76052189af209`, where web CI, native Windows CTest/build, and UI Smoke were all green. That evidence applies to that commit only; it must not be treated as validation of subsequent commits.

### Additional native render-contract hardening

Commit `07bf2a44712c26f9cce2d8eaa44255b36e750375` adds request validation to `GET /render/layers`:
- Reject a render layer with an empty source ID instead of incorrectly reporting the plan as ready.
- Reject unknown mapping modes; supported modes are `rectangle`, `corner-pin`, and `polygon`.
- Reject non-finite transform, crop, and mapping-point values.
- Reject non-positive width/height and opacity outside 0–1.
- Preserve the existing unresolved-source report: a syntactically valid layer whose source has not published a frame remains unresolved and must not be treated as ready.

### Acceptance status after this change

- **Code changed:** native render-layer request validation only.
- **CI for commit `07bf2a4`:** not yet confirmed by the available workflow/status lookup; treat as pending/unverified until GitHub Actions reports results.
- **Audio:** the ASIO capture engine and mixer tests exist, but the mixer is not connected to a real recording/streaming audio sink. Do not claim end-to-end audio.
- **Hardware:** camera/network input, physical display/LED, NDI/OMT runtime, recording/streaming, audio fan-out, and sustained 30 FPS still require runtime/hardware acceptance.
- **Delivery:** remain on `audit/engine-migration-2026-10-12`; do not merge to `main`, package an EXE, or begin installer/release work. UI fixes remain after engine validation.


### Audio output contract and runtime status

Commit `09d4286` makes the current audio boundary explicit in `GET /audio/mixer/status`: `connectedToOutput:false` and `outputIntegration:"not-connected"`. The master-gain endpoint now rejects partially parsed/non-finite values and reports an unavailable mixer instead of dereferencing a null pointer.

The correct next implementation boundary is **not** to drain AudioMixer samples from the 30 FPS video loop. ASIO capture is callback/ring-buffer driven, while video composition is frame/deadline driven. A safe output integration needs a clocked audio consumer and explicit fan-out to each supported output, sample-rate/channel conversion where needed, timestamps aligned to the output clock, and underrun/overflow accounting. Recording must add an audio stream to the Media Foundation sink writer; network protocols must use their supported audio-frame APIs. Until those sinks exist and pass tests, the API explicitly reports audio as disconnected.


## Execution update — audio recording path prototype (2026-10-14)

The isolated branch now contains a first native audio-to-recording path:
- ASIO's active sample rate is propagated to the audio engine and mixer; the engine stores the sample rate atomically for status reads.
- ASIO startup rejects a driver with fewer input channels than requested, avoiding reading interleaved stereo frames from a mono scratch buffer.
- When `VISCO_RECORD_PATH` and a working `VISCO_ASIO_DRIVER` are configured, the Media Foundation sink writer is configured with an AAC audio stream alongside the H.264 video stream.
- A dedicated paced audio-pump thread consumes mixer blocks independently of the 30 FPS video render loop and submits PCM blocks to the recording sink. Audio timestamps are derived from cumulative submitted sample frames at the configured ASIO sample rate; writer calls are serialized with a mutex.
- `GET /audio/mixer/status` now reports whether AAC recording audio is connected. NDI/OMT streaming audio remains explicitly unsupported by this path.
- Added a native mixer test for sample-rate propagation and retained the existing sample, gain, and underrun checks.

### Remaining acceptance gates for this audio prototype

- Automated workflow results for the new audio-path commits are **not yet visible/confirmed**; do not treat earlier green CI on commit `169afe9` as proof for this code.
- The Windows CI build/CTest must pass before considering the code-level gate green.
- A Windows runtime test with an actual ASIO driver must verify that the resulting MP4/MOV (depending on sink-writer URL/container) contains synchronized, audible AAC audio and H.264 video, and that long-running capture does not overflow the ASIO ring or accumulate A/V drift.
- Audio fan-out to NDI/OMT streaming is still not implemented. This change only targets Media Foundation recording.
- If the audio sink reports a write error, the audio pump stops instead of continuing to drain and discard ASIO samples.


### Validation update — current native audio prototype baseline

On commit `5f85a696708e302345d87724752b1b52cea01aad`, all three automated workflows completed successfully:
- [VisCo CI](https://github.com/prianggono/VisCo/actions/runs/38512869822): unit tests, typecheck, production build passed.
- [Native Windows CI](https://github.com/prianggono/VisCo/actions/runs/38512869819): CMake configure, Release build, and native CTest passed.
- [UI Smoke](https://github.com/prianggono/VisCo/actions/runs/38512869830): Playwright smoke suite passed.

This supersedes the earlier pending-CI note for the audio prototype at that tested commit. The native build and unit tests validate compilation and mixer behavior, not the Media Foundation AAC encoder's behavior with a real ASIO device. Actual file playback, A/V sync, long-duration overflow, and streaming audio remain unverified.
