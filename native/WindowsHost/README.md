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
