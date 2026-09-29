#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_6.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <wrl/client.h>
#include <iostream>
#include <string>
#include <vector>
#include <stdexcept>
#include <algorithm>

using Microsoft::WRL::ComPtr;

static void check(HRESULT hr, const char* what) {
  if (FAILED(hr)) throw std::runtime_error(what);
}

class D3D11Host {
  ComPtr<ID3D11Device> device_;
  ComPtr<ID3D11DeviceContext> context_;
  ComPtr<IDXGISwapChain1> swap_;
  ComPtr<ID3D11RenderTargetView> target_;
public:
  void initialize(HWND hwnd, UINT width, UINT height) {
    UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;
#if defined(_DEBUG)
    flags |= D3D11_CREATE_DEVICE_DEBUG;
#endif
    D3D_FEATURE_LEVEL level{};
    check(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, flags, nullptr, 0,
      D3D11_SDK_VERSION, &device_, &level, &context_), "D3D11CreateDevice failed");

    ComPtr<IDXGIDevice> dxgiDevice;
    check(device_.As(&dxgiDevice), "IDXGIDevice query failed");
    ComPtr<IDXGIAdapter> adapter;
    check(dxgiDevice->GetAdapter(&adapter), "DXGI adapter query failed");
    ComPtr<IDXGIFactory2> factory;
    check(adapter->GetParent(IID_PPV_ARGS(&factory)), "DXGI factory query failed");

    DXGI_SWAP_CHAIN_DESC1 desc{};
    desc.Width = width; desc.Height = height;
    desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    desc.SampleDesc.Count = 1;
    desc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    desc.BufferCount = 2;
    desc.SwapEffect = DXGI_SWAP_EFFECT_FLIP_DISCARD;
    check(factory->CreateSwapChainForHwnd(device_.Get(), hwnd, &desc, nullptr, nullptr, &swap_), "SwapChain creation failed");
    resizeTarget(width, height);
  }

  void resizeTarget(UINT width, UINT height) {
    if (!swap_) return;
    target_.Reset();
    check(swap_->ResizeBuffers(0, width, height, DXGI_FORMAT_UNKNOWN, 0), "ResizeBuffers failed");
    ComPtr<ID3D11Texture2D> back;
    check(swap_->GetBuffer(0, IID_PPV_ARGS(&back)), "Backbuffer query failed");
    check(device_->CreateRenderTargetView(back.Get(), nullptr, &target_), "RTV creation failed");
  }

  void render() {
    if (!target_) return;
    const float clear[4] = {0.f,0.f,0.f,1.f};
    context_->OMSetRenderTargets(1, target_.GetAddressOf(), nullptr);
    context_->ClearRenderTargetView(target_.Get(), clear);
    check(swap_->Present(1, 0), "Present failed");
  }
};

class MediaFoundationHost {
public:
  MediaFoundationHost() { check(MFStartup(MF_VERSION, MFSTARTUP_FULL), "MFStartup failed"); }
  ~MediaFoundationHost() { MFShutdown(); }

  std::vector<std::wstring> enumerateVideoDevices() {
    ComPtr<IMFAttributes> attrs;
    check(MFCreateAttributes(&attrs, 1), "MFCreateAttributes failed");
    check(attrs->SetGUID(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE, MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_GUID), "MF device attrs failed");
    IMFActivate** devices = nullptr; UINT32 count = 0;
    check(MFEnumDeviceSources(attrs.Get(), &devices, &count), "MFEnumDeviceSources failed");
    std::vector<std::wstring> result;
    for (UINT32 i=0;i<count;i++) {
      WCHAR* name = nullptr; UINT32 length = 0;
      if (SUCCEEDED(devices[i]->GetAllocatedString(MF_DEVSOURCE_ATTRIBUTE_FRIENDLY_NAME, &name, &length))) {
        result.emplace_back(name, length); CoTaskMemFree(name);
      }
      devices[i]->Release();
    }
    CoTaskMemFree(devices);
    return result;
  }
};

class WasapiHost {
public:
  std::vector<std::wstring> enumerate() {
    ComPtr<IMMDeviceEnumerator> enumerator;
    check(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL, IID_PPV_ARGS(&enumerator)), "MMDeviceEnumerator failed");
    ComPtr<IMMDeviceCollection> collection;
    check(enumerator->EnumAudioEndpoints(eCapture, DEVICE_STATE_ACTIVE, &collection), "EnumAudioEndpoints failed");
    UINT count=0; collection->GetCount(&count);
    std::vector<std::wstring> result;
    for(UINT i=0;i<count;i++) {
      ComPtr<IMMDevice> device; collection->Item(i,&device);
      LPWSTR id=nullptr; device->GetId(&id);
      if(id){ result.emplace_back(id); CoTaskMemFree(id); }
    }
    return result;
  }
};

class ArtNetHost {
  SOCKET socket_ = INVALID_SOCKET;
  sockaddr_in target_{};
public:
  ArtNetHost(const std::string& address, unsigned short port=6454) {
    WSADATA data{}; check(WSAStartup(MAKEWORD(2,2), &data), "WSAStartup failed");
    socket_ = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if(socket_ == INVALID_SOCKET) throw std::runtime_error("Art-Net socket failed");
    target_.sin_family=AF_INET; target_.sin_port=htons(port);
    if(inet_pton(AF_INET,address.c_str(),&target_.sin_addr)!=1) throw std::runtime_error("Invalid Art-Net address");
  }
  ~ArtNetHost(){ if(socket_!=INVALID_SOCKET) closesocket(socket_); WSACleanup(); }
  void sendDmx(const std::vector<unsigned char>& dmx, unsigned short universe=0) {
    std::vector<unsigned char> packet(18 + dmx.size(), 0);
    const char id[]="Art-Net"; memcpy(packet.data(),id,7);
    packet[8]=0x00; packet[9]=0x50; // OpDmx little-endian
    packet[10]=0; packet[11]=14; packet[12]=0; packet[13]=0;
    packet[14]=(universe & 0xff); packet[15]=(universe >> 8);
    packet[16]=static_cast<unsigned char>((dmx.size() >> 8) & 0xff);
    packet[17]=(static_cast<unsigned char>(dmx.size()) & 0xff);
    std::copy(dmx.begin(), dmx.end(), packet.begin()+18);
    sendto(socket_, reinterpret_cast<const char*>(packet.data()), static_cast<int>(packet.size()), 0,
      reinterpret_cast<sockaddr*>(&target_), sizeof(target_));
  }
};

static LRESULT CALLBACK windowProc(HWND hwnd, UINT msg, WPARAM w, LPARAM l) {
  if(msg==WM_DESTROY){ PostQuitMessage(0); return 0; }
  return DefWindowProc(hwnd,msg,w,l);
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int show) {
  try {
    const wchar_t* cls=L"VisCoNativeHost";
    WNDCLASSW wc{}; wc.lpfnWndProc=windowProc; wc.hInstance=instance; wc.lpszClassName=cls;
    RegisterClassW(&wc);
    HWND hwnd=CreateWindowExW(0,cls,L"VisCo Native Host",WS_OVERLAPPEDWINDOW,
      CW_USEDEFAULT,CW_USEDEFAULT,1280,720,nullptr,nullptr,instance,nullptr);
    if(!hwnd) throw std::runtime_error("CreateWindowEx failed");
    ShowWindow(hwnd,show);

    MediaFoundationHost media;
    D3D11Host renderer;
    renderer.initialize(hwnd,1280,720);
    WasapiHost audio;
    const auto cameras=media.enumerateVideoDevices();
    const auto audioDevices=audio.enumerate();
    std::wcout << L"VisCo native host ready. Cameras: " << cameras.size()
               << L", audio capture devices: " << audioDevices.size() << L"\n";

    MSG msg{};
    while(msg.message != WM_QUIT) {
      while(PeekMessageW(&msg,nullptr,0,0,PM_REMOVE)){ TranslateMessage(&msg); DispatchMessageW(&msg); }
      renderer.render();
      Sleep(33);
    }
    return 0;
  } catch(const std::exception& ex) {
    MessageBoxA(nullptr, ex.what(), "VisCo Native Host Error", MB_ICONERROR);
    return 1;
  }
}
