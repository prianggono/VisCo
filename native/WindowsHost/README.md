# VisCo Native Windows Host

This host is the native boundary for the Windows EXE runtime.

Implemented with Windows SDK APIs:
- Direct3D 11 device/context + swap chain + render target.
- Media Foundation startup and native video-device enumeration.
- WASAPI/MMDevice audio-device enumeration.
- Art-Net UDP packet sender primitive.
- 30 FPS render cadence.

The TypeScript runtime remains the application/control layer. NDI, OMT and ASIO are intentionally loaded through adapter boundaries because their SDKs are external dependencies; the host does not bundle proprietary SDKs.

Build on Windows with CMake and Visual Studio:
cmake -S native/WindowsHost -B build/native
cmake --build build/native --config Release


## Native control API
The Windows host exposes a loopback HTTP control endpoint on 127.0.0.1:47821 for the desktop/web UI:
- GET /health
- GET /devices?kind=camera
- GET /devices?kind=video-capture
- GET /devices?kind=audio-input

Video classification is performed by the Windows Media Foundation device category, not by React or device-name heuristics. The UI never guesses whether a device is a camera or capture card.

The current host provides native discovery and Art-Net transport plus the D3D11/MF/WASAPI runtime boundary. NDI, OMT and ASIO remain external-SDK adapters and are intentionally not faked as implemented when their SDKs are absent.


## Live native frame path

The Windows host now contains a real capture-to-render vertical slice:

`Media Foundation capture device -> IMFSourceReader (RGB32) -> native frame buffer -> D3D11 texture/shader -> swap chain`.

The first detected video device is started automatically at 1280x720/30 FPS. The control API can switch capture with:

- `GET /capture/start?device=win-video-N`
- `GET /capture/stop`
- `GET /runtime`

A local MJPEG preview is exposed at `http://127.0.0.1:47822/preview.mjpg` for the web Preview/Program monitors. This HTTP/MJPEG path is a development/bridge path; the production render path remains native D3D11.

Media Foundation Source Reader is used from an already-created capture media source, which is the Windows-supported pattern for capture devices. The reader is configured for RGB32 and requested frame size/rate, with a resilient fallback when a device rejects the exact mode.

NDI, OMT, and ASIO are **runtime-discovered, not bundled**. The native host probes their runtime libraries and exposes availability through `/runtime`. Protocol-specific ABI bindings remain an adapter boundary and are only activated when the corresponding SDK/runtime is installed; no proprietary SDK is copied into VisCo.

For OMT, the expected native runtime is the official `libomt` family (with `libvmx` for VMX codec support). For NDI, the host probes the Processing.NDI runtime DLL. For ASIO, the host probes an installed ASIO runtime DLL. Environment variables `VISCO_NDI_DLL`, `VISCO_OMT_DLL`, and `VISCO_ASIO_DLL` can override library discovery.



## Native network frame acquisition

The Windows host now has a real native network receive path for NDI and OMT. The receiver produces the same `NativeVideoFrame` used by the D3D11 renderer; React/TypeScript does not implement protocol logic.

Environment startup:

- `VISCO_NETWORK_PROTOCOL=ndi` or `omt`
- `VISCO_NETWORK_SOURCE=<NDI source name or OMT address>`

HTTP control endpoints on loopback port 47821:

- `GET /network/discover?protocol=ndi`
- `GET /network/discover?protocol=omt`
- `GET /network/start?protocol=ndi&source=<source>`
- `GET /network/start?protocol=omt&source=<address>`
- `GET /network/stop`
- `GET /network/status`

If the requested SDK/runtime is not installed, the network receiver stays offline and the host can continue using Media Foundation capture. No missing SDK is treated as a fatal application condition.

The D3D11 host is paced at the project's 30 FPS default. The network receiver itself does not force 60 FPS or create an independent render loop.


## Native output configuration

Optional environment variables:

- `VISCO_RECORD_PATH=C:\\path\\output.mp4` enables Media Foundation H.264 recording.
- `VISCO_VIRTUAL_OUTPUT=VisCoVirtualOut` enables the named shared-memory Virtual Output.
- `VISCO_STREAM_PROTOCOL=ndi` or `omt`.
- `VISCO_STREAM_NAME=VisCo Program` selects the NDI source name or OMT sender name.

These outputs share the host's selected native BGRA frame and use the 30 FPS default.
