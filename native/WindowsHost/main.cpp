#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_6.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <ks.h>
#include <ksmedia.h>
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
#include <thread>
#include <atomic>
#include <sstream>
#include <cctype>

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

  struct VideoDeviceInfo { std::wstring name; std::wstring symbolicLink; bool camera; };

  std::vector<VideoDeviceInfo> enumerateVideoDeviceInfo() {
    ComPtr<IMFAttributes> attrs;
    check(MFCreateAttributes(&attrs, 1), "MFCreateAttributes failed");
    check(attrs->SetGUID(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE, MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_GUID), "MF device attrs failed");
    IMFActivate** devices = nullptr; UINT32 count = 0;
    check(MFEnumDeviceSources(attrs.Get(), &devices, &count), "MFEnumDeviceSources failed");
    std::vector<VideoDeviceInfo> result;
    for (UINT32 i=0;i<count;i++) {
      WCHAR* name = nullptr; UINT32 nameLength = 0;
      WCHAR* link = nullptr; UINT32 linkLength = 0;
      GUID category{};
      const HRESULT catHr = devices[i]->GetGUID(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_CATEGORY, &category);
      if (SUCCEEDED(devices[i]->GetAllocatedString(MF_DEVSOURCE_ATTRIBUTE_FRIENDLY_NAME, &name, &nameLength))) {
        devices[i]->GetAllocatedString(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_SYMBOLIC_LINK, &link, &linkLength);
        result.push_back({
          std::wstring(name, nameLength),
          link ? std::wstring(link, linkLength) : L"",
          SUCCEEDED(catHr) && IsEqualGUID(category, KSCATEGORY_VIDEO_CAMERA)
        });
      }
      if (name) CoTaskMemFree(name);
      if (link) CoTaskMemFree(link);
      devices[i]->Release();
    }
    CoTaskMemFree(devices);
    return result;
  }

  std::vector<std::wstring> enumerateVideoDevices() {
    std::vector<std::wstring> result;
    for (const auto& item : enumerateVideoDeviceInfo()) result.push_back(item.name);
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

static std::string jsonEscape(const std::wstring& input) {
  std::string out;
  for (wchar_t ch : input) {
    if (ch == L'\\') out += "\\\\";
    else if (ch == L'"') out += "\\\"";
    else if (ch >= 32 && ch < 127) out.push_back(static_cast<char>(ch));
    else out += "?";
  }
  return out;
}

class HttpControlServer {
  SOCKET listener_ = INVALID_SOCKET;
  std::atomic<bool> running_{false};
  std::thread thread_;
  MediaFoundationHost* media_ = nullptr;
  WasapiHost* audio_ = nullptr;

  static void sendResponse(SOCKET client, const std::string& body, const char* status = "200 OK") {
    std::ostringstream response;
    response << "HTTP/1.1 " << status << "\r\n"
             << "Content-Type: application/json; charset=utf-8\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Access-Control-Allow-Headers: Content-Type\r\n"
             << "Cache-Control: no-store\r\n"
             << "Content-Length: " << body.size() << "\r\n\r\n" << body;
    const auto text = response.str();
    send(client, text.data(), static_cast<int>(text.size()), 0);
  }

  void handle(SOCKET client) {
    char buffer[8192]{};
    const int received = recv(client, buffer, sizeof(buffer)-1, 0);
    if (received <= 0) { closesocket(client); return; }
    std::string request(buffer, received);
    const auto lineEnd = request.find("\r\n");
    const std::string requestLine = request.substr(0, lineEnd);
    if (requestLine.rfind("OPTIONS ", 0) == 0) {
      sendResponse(client, "{}", "204 No Content");
    } else if (requestLine.rfind("GET /health", 0) == 0) {
      sendResponse(client, R"({"available":true,"version":"native-host-1","backend":"d3d11","capture":"media-foundation","audio":"wasapi","led":"art-net"})");
    } else if (requestLine.rfind("GET /devices", 0) == 0) {
      const auto q = requestLine.find("kind=");
      std::string kind = q == std::string::npos ? "" : requestLine.substr(q + 5);
      const auto amp = kind.find('&'); if (amp != std::string::npos) kind.resize(amp);
      if (kind == "camera" || kind == "video-capture" || kind == "desktop-capture") {
        const auto devices = media_->enumerateVideoDeviceInfo();
        std::ostringstream body; body << "{\"devices\":[";
        bool first = true;
        for (size_t i=0;i<devices.size();++i) {
          const bool matches = (kind == "camera" && devices[i].camera) ||
                               (kind == "video-capture" && !devices[i].camera);
          if (!matches) continue;
          if (!first) body << ",";
          first = false;
          const std::string name = jsonEscape(devices[i].name);
          const std::string link = jsonEscape(devices[i].symbolicLink);
          body << "{\"id\":\"win-video-" << i << "\",\"name\":\"" << name
               << "\",\"kind\":\"" << (devices[i].camera ? "camera" : "video-capture")
               << "\",\"transport\":\"local\",\"metadata\":{\"backend\":\"media-foundation\",\"symbolicLink\":\"" << link << "\"}}";
        }
        body << "]}";
        sendResponse(client, body.str());
      } else if (kind == "audio-input") {
        const auto devices = audio_->enumerate();
        std::ostringstream body; body << "{\"devices\":[";
        for (size_t i=0;i<devices.size();++i) {
          if (i) body << ",";
          body << "{\"id\":\"wasapi-" << i << "\",\"name\":\"Audio Capture "
               << i << "\",\"kind\":\"audio-input\",\"transport\":\"local\"}";
        }
        body << "]}";
        sendResponse(client, body.str());
      } else {
        sendResponse(client, R"({"devices":[],"message":"Protocol-specific native adapter is not bundled in this host."})");
      }
    } else {
      sendResponse(client, R"({"message":"Not found"})", "404 Not Found");
    }
    closesocket(client);
  }

  void loop() {
    while (running_) {
      sockaddr_in clientAddr{}; int clientLen = sizeof(clientAddr);
      SOCKET client = accept(listener_, reinterpret_cast<sockaddr*>(&clientAddr), &clientLen);
      if (client != INVALID_SOCKET) handle(client);
      else Sleep(10);
    }
  }

public:
  void start(MediaFoundationHost& media, WasapiHost& audio, unsigned short port = 47821) {
    media_ = &media; audio_ = &audio;
    WSADATA data{}; check(WSAStartup(MAKEWORD(2,2), &data), "WSAStartup failed");
    listener_ = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (listener_ == INVALID_SOCKET) throw std::runtime_error("Native HTTP socket failed");
    BOOL reuse = TRUE; setsockopt(listener_, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&reuse), sizeof(reuse));
    u_long nonBlocking = 1; ioctlsocket(listener_, FIONBIO, &nonBlocking);
    sockaddr_in address{}; address.sin_family=AF_INET; address.sin_addr.s_addr=htonl(INADDR_LOOPBACK); address.sin_port=htons(port);
    if (bind(listener_, reinterpret_cast<sockaddr*>(&address), sizeof(address)) != 0 || listen(listener_, 8) != 0)
      throw std::runtime_error("Native HTTP bind/listen failed");
    running_ = true;
    thread_ = std::thread([this]{ loop(); });
  }

  ~HttpControlServer() {
    running_ = false;
    if (listener_ != INVALID_SOCKET) { closesocket(listener_); listener_ = INVALID_SOCKET; }
    if (thread_.joinable()) thread_.join();
    WSACleanup();
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
    HttpControlServer http;
    http.start(media, audio);
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
