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
