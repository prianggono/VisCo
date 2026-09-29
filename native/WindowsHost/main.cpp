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
#include <cstdlib>
#include "capture-runtime.h"
#include "runtime-adapters.h"
#include "network-frame-runtime.h"
#include "output-runtime.h"
#include "asio-audio-runtime.h"

using Microsoft::WRL::ComPtr;

static void check(HRESULT hr, const char* what) {
  if (FAILED(hr)) throw std::runtime_error(what);
}

class WasapiHost {
public:
  std::vector<std::wstring> enumerate() {
    ComPtr<IMMDeviceEnumerator> enumerator;
    check(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL, IID_PPV_ARGS(&enumerator)), "MMDeviceEnumerator failed");
    ComPtr<IMMDeviceCollection> collection;
    check(enumerator->EnumAudioEndpoints(eCapture, DEVICE_STATE_ACTIVE, &collection), "EnumAudioEndpoints failed");
    UINT count=0; collection->GetCount(&count);
    std::vector<std::wstring> result;
    for(UINT i=0;i<count;i++){
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
  MediaCaptureHost* capture_ = nullptr;
  RuntimeAdapterRegistry* runtimes_ = nullptr;
  NetworkFrameRuntime* network_ = nullptr;
  visco_asio::AsioAudioRuntime* asio_ = nullptr;
  visco_asio::AudioEngine* audioEngine_ = nullptr;
  HWND asioWindow_ = nullptr;

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
    } else if (requestLine.rfind("GET /runtime", 0) == 0) {
      sendResponse(client, runtimes_ ? runtimes_->json() : R"({"adapters":[]})");
    } else if (requestLine.rfind("GET /asio/drivers", 0) == 0) {
      const auto drivers = visco_asio::AsioAudioRuntime::enumerateDrivers();
      std::ostringstream body; body << "{\"drivers\":[";
      for (size_t i=0;i<drivers.size();++i) {
        if (i) body << ",";
        body << "{\"id\":\"" << drivers[i].id << "\",\"name\":\"" << drivers[i].name
             << "\",\"description\":\"" << drivers[i].description << "\",\"clsid\":\"" << drivers[i].clsid << "\"}";
      }
      body << "]}"; sendResponse(client, body.str());
    } else if (requestLine.rfind("GET /asio/start", 0) == 0) {
      const auto d = requestLine.find("driver=");
      std::string driver = d == std::string::npos ? "" : requestLine.substr(d + 7);
      const auto amp = driver.find('&'); if (amp != std::string::npos) driver.resize(amp);
      if (!asio_ || driver.empty()) {
        sendResponse(client, R"({"ok":false,"message":"ASIO driver is required."})", "400 Bad Request");
      } else if (asio_->start(driver, asioWindow_, 2)) {
        const auto info = asio_->activeDriver();
        std::ostringstream body;
        body << "{\"ok\":true,\"running\":true,\"driver\":\"" << info.name
             << "\",\"sampleRate\":" << asio_->sampleRate()
             << ",\"channels\":" << asio_->inputChannels()
             << ",\"bufferFrames\":" << asio_->bufferFrames() << "}";
        sendResponse(client, body.str());
      } else {
        sendResponse(client, std::string(R"({"ok":false,"message":")") + asio_->error() + R"("})", "500 Internal Server Error");
      }
    } else if (requestLine.rfind("GET /asio/stop", 0) == 0) {
      if (asio_) asio_->stop();
      sendResponse(client, R"({"ok":true,"running":false})");
    } else if (requestLine.rfind("GET /asio/status", 0) == 0) {
      const auto s = audioEngine_ ? audioEngine_->stats() : visco_asio::AudioEngineStats{};
      std::ostringstream body;
      body << "{\"running\":" << (asio_ && asio_->running() ? "true" : "false")
           << ",\"sampleRate\":" << s.sampleRate << ",\"channels\":" << s.channels
           << ",\"bufferFrames\":" << (asio_ ? asio_->bufferFrames() : 0)
           << ",\"callbackBlocks\":" << s.callbackBlocks << ",\"callbackFrames\":" << s.callbackFrames
           << ",\"droppedFrames\":" << s.droppedFrames << ",\"overruns\":" << s.overruns
           << ",\"availableFrames\":" << (audioEngine_ ? audioEngine_->availableFrames() : 0)
           << "}"; sendResponse(client, body.str());
    } else if (requestLine.rfind("GET /network/discover", 0) == 0) {
      const auto p = requestLine.find("protocol=");
      const std::string protocol = p == std::string::npos ? "" : requestLine.substr(p + 9);
      const NetworkProtocol kind = protocol == "ndi" ? NetworkProtocol::NDI : protocol == "omt" ? NetworkProtocol::OMT : NetworkProtocol::None;
      if (kind == NetworkProtocol::None) {
        sendResponse(client, R"({"devices":[],"message":"protocol must be ndi or omt"})", "400 Bad Request");
      } else {
        const auto sources = network_->discover(kind);
        std::ostringstream body; body << "{\"devices\":[";
        for (size_t i=0;i<sources.size();++i) {
          if(i) body << ",";
          body << "{\"id\":\"" << sources[i].id << "\",\"name\":\"" << sources[i].name
               << "\",\"kind\":\"" << (kind==NetworkProtocol::NDI ? "ndi" : "omt")
               << "\",\"transport\":\"network\",\"address\":\"" << sources[i].address << "\"}";
        }
        body << "]}"; sendResponse(client, body.str());
      }
    } else if (requestLine.rfind("GET /network/start", 0) == 0) {
      const auto pp = requestLine.find("protocol=");
      const auto ss = requestLine.find("source=");
      const auto protocolEnd = pp == std::string::npos ? std::string::npos : requestLine.find('&', pp);
      const std::string protocol = pp == std::string::npos ? "" : requestLine.substr(pp + 9, protocolEnd == std::string::npos ? std::string::npos : protocolEnd - (pp + 9));
      const std::string source = ss == std::string::npos ? "" : requestLine.substr(ss + 7);
      const NetworkProtocol kind = protocol == "ndi" ? NetworkProtocol::NDI : protocol == "omt" ? NetworkProtocol::OMT : NetworkProtocol::None;
      try {
        if(kind == NetworkProtocol::None || source.empty()) throw std::runtime_error("Network protocol and source are required.");
        network_->start(kind, source);
        sendResponse(client, std::string(R"({"ok":true,"running":true,"protocol":")") +
          (kind==NetworkProtocol::NDI ? "ndi" : "omt") + R"(","source":")" + source + R"("})");
      } catch(const std::exception& ex) {
        sendResponse(client, std::string(R"({"ok":false,"message":")") + ex.what() + R"("})", "500 Internal Server Error");
      }
    } else if (requestLine.rfind("GET /network/stop", 0) == 0) {
      network_->stop();
      sendResponse(client, R"({"ok":true,"running":false})");
    } else if (requestLine.rfind("GET /network/status", 0) == 0) {
      std::ostringstream body;
      body << "{\"running\":" << (network_->running() ? "true" : "false")
           << ",\"protocol\":\"" << (network_->protocol()==NetworkProtocol::NDI ? "ndi" : network_->protocol()==NetworkProtocol::OMT ? "omt" : "none")
           << "\",\"error\":\"" << network_->error() << "\"}";
      sendResponse(client, body.str());
    } else if (requestLine.rfind("GET /capture/start", 0) == 0) {
      const auto q = requestLine.find("device=");
      std::string id = q == std::string::npos ? "" : requestLine.substr(q + 7);
      const auto amp = id.find('&'); if (amp != std::string::npos) id.resize(amp);
      if (id.rfind("win-video-", 0) != 0) {
        sendResponse(client, R"({"ok":false,"message":"Invalid capture device id."})", "400 Bad Request");
      } else {
        try {
          const size_t index = std::stoul(id.substr(10));
          const auto devices = media_->enumerateVideoDeviceInfo();
          if (index >= devices.size()) throw std::runtime_error("Capture device not found.");
          capture_->start(devices[index].symbolicLink, 1280, 720, 30);
          sendResponse(client, R"({"ok":true,"running":true,"device":")" + id + R"("})");
        } catch (const std::exception& ex) {
          sendResponse(client, std::string(R"({"ok":false,"message":")") + ex.what() + R"("})", "500 Internal Server Error");
        }
      }
    } else if (requestLine.rfind("GET /capture/stop", 0) == 0) {
      capture_->stop();
      sendResponse(client, R"({"ok":true,"running":false})");
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
    const HRESULT co = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    while (running_) {
      sockaddr_in clientAddr{}; int clientLen = sizeof(clientAddr);
      SOCKET client = accept(listener_, reinterpret_cast<sockaddr*>(&clientAddr), &clientLen);
      if (client != INVALID_SOCKET) handle(client);
      else Sleep(10);
    }
    if (SUCCEEDED(co)) CoUninitialize();
  }

public:
  void start(MediaFoundationHost& media, WasapiHost& audio, MediaCaptureHost& capture, RuntimeAdapterRegistry& runtimes, NetworkFrameRuntime& network, visco_asio::AsioAudioRuntime& asio, visco_asio::AudioEngine& audioEngine, unsigned short port = 47821) {
    media_ = &media; audio_ = &audio; capture_ = &capture; runtimes_ = &runtimes; network_ = &network; asio_ = &asio; audioEngine_ = &audioEngine; asioWindow_ = GetConsoleWindow();
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
  if(msg==WM_KEYDOWN && w==VK_ESCAPE){ PostQuitMessage(0); return 0; }
  if(msg==WM_DESTROY){ PostQuitMessage(0); return 0; }
  return DefWindowProc(hwnd,msg,w,l);
}

static std::vector<RECT> enumerateMonitorRects() {
  std::vector<RECT> rects;
  EnumDisplayMonitors(nullptr, nullptr, [](HMONITOR monitor, HDC, LPRECT rect, LPARAM data)->BOOL {
    auto* list = reinterpret_cast<std::vector<RECT>*>(data);
    MONITORINFO info{}; info.cbSize=sizeof(info);
    if(GetMonitorInfoW(monitor,&info)) list->push_back(info.rcMonitor);
    return TRUE;
  }, reinterpret_cast<LPARAM>(&rects));
  return rects;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int show) {
  const HRESULT co = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  try {
    const wchar_t* cls=L"VisCoNativeHost";
    WNDCLASSW wc{}; wc.lpfnWndProc=windowProc; wc.hInstance=instance; wc.lpszClassName=cls;
    RegisterClassW(&wc);
    const auto monitors = enumerateMonitorRects();
    const bool physicalOutput = monitors.size() >= 2;
    const RECT outputRect = physicalOutput ? monitors[1] : RECT{CW_USEDEFAULT,CW_USEDEFAULT,1280,720};
    const DWORD style = physicalOutput ? WS_POPUP : WS_OVERLAPPEDWINDOW;
    const int outputWidth = physicalOutput ? (outputRect.right-outputRect.left) : 1280;
    const int outputHeight = physicalOutput ? (outputRect.bottom-outputRect.top) : 720;
    HWND hwnd=CreateWindowExW(physicalOutput ? WS_EX_TOPMOST : 0,cls,L"VisCo Native Host",style,
      physicalOutput ? outputRect.left : CW_USEDEFAULT,
      physicalOutput ? outputRect.top : CW_USEDEFAULT,
      outputWidth,outputHeight,nullptr,nullptr,instance,nullptr);
    if(!hwnd) throw std::runtime_error("CreateWindowEx failed");
    ShowWindow(hwnd, physicalOutput ? SW_SHOW : show);

    MediaFoundationHost media;
    D3D11Host renderer;
    renderer.initialize(hwnd,static_cast<UINT>(outputWidth),static_cast<UINT>(outputHeight));
    WasapiHost audio;
    const auto cameras=media.enumerateVideoDevices();
    const auto audioDevices=audio.enumerate();
    MediaCaptureHost capture(media);
    MjpegPreviewServer preview(capture);
    preview.start(47822);
    RuntimeAdapterRegistry runtimes;
    NetworkFrameRuntime network;
    NativeOutputRuntime outputs;
    visco_asio::AudioEngine audioEngine(48000, 2, 96000);
    visco_asio::AsioAudioRuntime asio(audioEngine);
    const char* asioDriver = std::getenv("VISCO_ASIO_DRIVER");
    if (asioDriver && *asioDriver) {
      if (!asio.start(asioDriver, hwnd, 2)) std::cerr << "ASIO offline: " << asio.error() << "\n";
    }
    const char* envProtocol = std::getenv("VISCO_NETWORK_PROTOCOL");
    const char* envSource = std::getenv("VISCO_NETWORK_SOURCE");
    if (envProtocol && envSource && *envProtocol && *envSource) {
      try {
        network.start(std::string(envProtocol) == "ndi" ? NetworkProtocol::NDI : NetworkProtocol::OMT, envSource);
      } catch (const std::exception& ex) { std::cerr << "Network source offline: " << ex.what() << "\n"; }
    }
    if (!media.enumerateVideoDeviceInfo().empty()) {
      capture.start(media.enumerateVideoDeviceInfo().front().symbolicLink, 1280, 720, 30);
    }
    const char* recordPath = std::getenv("VISCO_RECORD_PATH");
    if (recordPath && *recordPath) outputs.startRecord(recordPath, static_cast<UINT>(outputWidth), static_cast<UINT>(outputHeight), 30);
    const char* virtualName = std::getenv("VISCO_VIRTUAL_OUTPUT");
    if (virtualName && *virtualName) outputs.startVirtual(virtualName, static_cast<UINT>(outputWidth), static_cast<UINT>(outputHeight), 30);
    const char* streamProtocol = std::getenv("VISCO_STREAM_PROTOCOL");
    const char* streamName = std::getenv("VISCO_STREAM_NAME");
    if (streamProtocol && streamName && *streamProtocol && *streamName) {
      outputs.startStream(std::string(streamProtocol) == "ndi" ? NativeStreamProtocol::NDI : NativeStreamProtocol::OMT,
                          streamName, static_cast<UINT>(outputWidth), static_cast<UINT>(outputHeight), 30);
    }

    HttpControlServer http;
    http.start(media, audio, capture, runtimes, network, asio, audioEngine);
    std::wcout << L"VisCo native host ready. Cameras: " << cameras.size()
               << L", audio capture devices: " << audioDevices.size() << L"\n";

    MSG msg{};
    UINT64 outputFrameNumber = 0;
    while(msg.message != WM_QUIT) {
      while(PeekMessageW(&msg,nullptr,0,0,PM_REMOVE)){ TranslateMessage(&msg); DispatchMessageW(&msg); }
      const auto networkFrame = network.latest();
      const auto frame = network.running() ? networkFrame : capture.latest();
      renderer.render(frame);
      outputs.submit(frame, outputFrameNumber++);
      Sleep(33);
    }
    if (SUCCEEDED(co)) CoUninitialize();
    return 0;
  } catch(const std::exception& ex) {
    MessageBoxA(nullptr, ex.what(), "VisCo Native Host Error", MB_ICONERROR);
    if (SUCCEEDED(co)) CoUninitialize();
    return 1;
  }
}
