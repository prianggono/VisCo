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
