# VisCo Technical Audit — 2026-10-12

## Scope and safety

This is a source-level audit of the GitHub files accessible during this session. A dedicated branch, `audit/engine-migration-2026-10-12`, was created from `main`; all changes described here remain isolated from `main`. One narrow native fallback-selection correction was made on this branch after the source audit; it is not yet validated by a successful Windows build.

Latest commit found by repository commit search: `e14181dbd3e3bd97ad7979d46fe33533aa9c6ca9` (`test(ui): cover Program Deck reclaim after X`, 2026-10-07). Branches found: `main` and `feat/real-media-rendering`. The commit's combined status returned no status entries and the workflow-run query returned no runs; this is **unknown/unverified**, not a passing CI result.

## 1. Engine and dependency audit

### Web application
- `package.json`: React 19, Vite 7, TypeScript 5.9, Vitest 3, Playwright 1.55.
- Scripts: `npm test`, `npm run build`, `npm run typecheck`. There is no native build script.
- `.github/workflows/ci.yml` installs Node 20, runs `npm install`, `npm test`, and `npm run build` on Ubuntu. It does not configure MSVC/Windows SDK or invoke CMake.
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

## 5. Validation gates (not yet passed)

1. Web: run `npm install`, `npm test`, `npm run typecheck`, and `npm run build` (`package-lock.json` was not found, so `npm ci` is not currently applicable).
2. UI E2E: start the Vite preview server on port 4173 and run the Playwright smoke suite separately; ensure the browser-only optional-host connection refusal is the only suppressed error.
3. Native: build with supported Windows/MSVC + Windows SDK using CMake; preserve compiler output and test the actual EXE.
4. Integration: prove UI Deck/Layer state reaches the native render plan; Preview does not alter Program; Program transitions are Deck-owned; Trigger sequences do not duplicate routing; output overrides are Deck-level.
5. Media: test capture → frame registry → composition renderer → physical display; then each of Stream, Record and Virtual Out independently and together at target 30 fps.
6. Audio: test ASIO/WASAPI device discovery, callback stability, clipping/underruns, gain, and external-audio fan-out to every agreed destination.
7. Resilience/performance: repeated source changes, missing SDK/DLL, device unplug/reconnect, crash recovery, and measured frame pacing/CPU/GPU/memory on target hardware.

## Changes made on the isolated audit branch

- Corrected native fallback selection so the capture source is not appended to a non-empty render composition.
- Expanded `.github/workflows/ci.yml` to include strict TypeScript checking, a separately runnable Playwright UI E2E job, and a Windows/MSVC CMake build job.
- Added this audit report and opened draft PR #1. `main` has not been modified.

## Current disposition

- No CI/build/test result is being reported as green. The GitHub connector currently returns no status entries or workflow runs for the branch commit; the new workflow jobs therefore remain pending/unverified from this session.
- The native fallback correction is a source-level fix only until Windows build and runtime regression validation pass.
- Next fixes must be based on CI results and targeted tests; no broader engine migration should begin until the current native and UI paths are validated.
