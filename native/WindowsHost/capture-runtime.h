#pragma once
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <d3dcompiler.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <wincodec.h>
#include <wrl/client.h>
#include <winsock2.h>
#include <string>
#include <vector>
#include <mutex>
#include <thread>
#include <atomic>
#include <memory>
#include <cstdint>

using Microsoft::WRL::ComPtr;

struct NativeVideoFrame {
  UINT width = 0;
  UINT height = 0;
  UINT64 timestampUs = 0;
  std::vector<unsigned char> bgra;
};

struct NativeRenderLayer {
  std::shared_ptr<const NativeVideoFrame> frame;
  float x = 0.0f;
  float y = 0.0f;
  float width = 1.0f;
  float height = 1.0f;
  float rotation = 0.0f;
  float scaleX = 1.0f;
  float scaleY = 1.0f;
  float opacity = 1.0f;
  int order = 0;
};

class MediaFoundationHost {
public:
  MediaFoundationHost();
  ~MediaFoundationHost();
  struct VideoDeviceInfo { std::wstring name; std::wstring symbolicLink; bool camera; };
  std::vector<VideoDeviceInfo> enumerateVideoDeviceInfo();
  std::vector<std::wstring> enumerateVideoDevices();
  ComPtr<IMFMediaSource> createSource(const std::wstring& symbolicLink);
};

class MediaCaptureHost {
public:
  explicit MediaCaptureHost(MediaFoundationHost& media);
  ~MediaCaptureHost();
  void start(const std::wstring& symbolicLink, UINT width = 1280, UINT height = 720, UINT fps = 30);
  void stop();
  std::shared_ptr<const NativeVideoFrame> latest() const;
  bool running() const { return running_; }
  std::string error() const;

private:
  void loop(std::wstring symbolicLink, UINT width, UINT height, UINT fps);
  MediaFoundationHost& media_;
  mutable std::mutex mutex_;
  std::shared_ptr<NativeVideoFrame> latest_;
  std::string error_;
  std::thread thread_;
  std::atomic<bool> running_{false};
};

class D3D11Host {
public:
  void initialize(HWND hwnd, UINT width, UINT height);
  std::shared_ptr<const NativeVideoFrame> render(const std::shared_ptr<const NativeVideoFrame>& frame);
  std::shared_ptr<const NativeVideoFrame> renderComposition(const std::vector<NativeRenderLayer>& layers);
  std::shared_ptr<const NativeVideoFrame> latestFinal() const;
  void resizeTarget(UINT width, UINT height);
private:
  ComPtr<ID3D11Device> device_;
  ComPtr<ID3D11DeviceContext> context_;
  ComPtr<IDXGISwapChain1> swap_;
  ComPtr<ID3D11RenderTargetView> target_;
  ComPtr<ID3D11Texture2D> videoTexture_;
  ComPtr<ID3D11ShaderResourceView> videoView_;
  ComPtr<ID3D11SamplerState> sampler_;
  ComPtr<ID3D11Texture2D> readbackTexture_;
  ComPtr<ID3D11VertexShader> vertexShader_;
  ComPtr<ID3D11PixelShader> pixelShader_;
  mutable std::mutex finalMutex_;
  std::shared_ptr<const NativeVideoFrame> latestFinal_;
  UINT videoWidth_ = 0;
  UINT videoHeight_ = 0;
  void ensureVideoTexture(UINT width, UINT height);
  void initializeShaders();
};

class MjpegPreviewServer {
public:
  explicit MjpegPreviewServer(D3D11Host& renderer) : renderer_(renderer) {}
  ~MjpegPreviewServer();
  void start(unsigned short port = 47822);
private:
  void loop();
  void streamClient(SOCKET client);
  D3D11Host& renderer_;
  SOCKET listener_ = INVALID_SOCKET;
  std::atomic<bool> running_{false};
  std::thread thread_;
  ComPtr<IWICImagingFactory> wic_;
  std::vector<unsigned char> encodeJpeg(const NativeVideoFrame& frame);
  bool sendAll(SOCKET client, const void* data, size_t size);
};
