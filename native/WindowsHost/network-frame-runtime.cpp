#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "network-frame-runtime.h"
#include <windows.h>
#include <cstring>
#include <sstream>
#include <stdexcept>
#include <algorithm>
#include <cstdlib>

namespace {
using OMTReceive = long long;
enum OMTFrameType { OMTFrameType_Video = 2 };
enum OMTCodec { OMTCodec_BGRA = 0x41524742 };
struct OMTMediaFrame {
  int Type; long long Timestamp; int Codec; int Width; int Height; int Stride; int Flags;
  int FrameRateN; int FrameRateD; float AspectRatio; int ColorSpace;
  int SampleRate; int Channels; int SamplesPerChannel;
  void* Data; int DataLength; void* CompressedData; int CompressedLength;
  void* FrameMetadata; int FrameMetadataLength;
};
using OmtCreateFn = OMTReceive* (__cdecl*)(const char*, int, int, int);
using OmtDestroyFn = void (__cdecl*)(OMTReceive*);
using OmtReceiveFn = OMTMediaFrame* (__cdecl*)(OMTReceive*, int, int);
using OmtShutdownFn = void (__cdecl*)();

struct OmtApi {
  HMODULE module = nullptr;
  OmtCreateFn create = nullptr;
  OmtDestroyFn destroy = nullptr;
  OmtReceiveFn receive = nullptr;
  OmtShutdownFn shutdown = nullptr;

  bool load() {
    if (module) return true;
    const char* env = std::getenv("VISCO_OMT_DLL");
    module = LoadLibraryA(env && *env ? env : "libomt.dll");
    if (!module) return false;
    create = reinterpret_cast<OmtCreateFn>(GetProcAddress(module, "omt_receive_create"));
    destroy = reinterpret_cast<OmtDestroyFn>(GetProcAddress(module, "omt_receive_destroy"));
    receive = reinterpret_cast<OmtReceiveFn>(GetProcAddress(module, "omt_receive"));
    shutdown = reinterpret_cast<OmtShutdownFn>(GetProcAddress(module, "omt_shutdown"));
    if (!create || !destroy || !receive) { FreeLibrary(module); module=nullptr; return false; }
    return true;
  }
  ~OmtApi() { if (shutdown) shutdown(); if (module) FreeLibrary(module); }
};

using NdiInstance = void*;
struct NdiSource { const char* p_ndi_name; const char* p_url_address; };
enum NdiFrameType { NdiNone=0, NdiVideo=1, NdiAudio=2, NdiMetadata=3, NdiError=4 };
enum NdiColor { NdiBgrxBgra=0 };
enum NdiBandwidth { NdiHighest=100 };
struct NdiRecvCreate {
  NdiSource source;
  int color_format;
  int bandwidth;
  bool allow_video_fields;
  const char* receiver_name;
};
struct NdiVideoFrame {
  int xres, yres, fourcc;
  int frame_rate_N, frame_rate_D;
  float aspect;
  int frame_format;
  long long timecode;
  unsigned char* data;
  int stride;
  const char* metadata;
  long long timestamp;
};
using NdiInitFn = bool (__cdecl*)();
using NdiDestroyFn = void (__cdecl*)();
using NdiFindCreateFn = void* (__cdecl*)(const void*);
using NdiFindDestroyFn = void (__cdecl*)(void*);
using NdiFindGetSourcesFn = const NdiSource* (__cdecl*)(void*, unsigned int*, unsigned int);
using NdiRecvCreateFn = NdiInstance (__cdecl*)(const NdiRecvCreate*);
using NdiRecvDestroyFn = void (__cdecl*)(NdiInstance);
using NdiRecvCaptureFn = int (__cdecl*)(NdiInstance, NdiVideoFrame*, void*, void*, unsigned int);
using NdiRecvFreeVideoFn = void (__cdecl*)(NdiInstance, const NdiVideoFrame*);

struct NdiFindCreate { bool show_local_sources; const char* p_groups; const char* p_extra_ips; };
struct NdiApi {
  HMODULE module=nullptr; NdiInitFn initialize=nullptr; NdiDestroyFn destroy=nullptr;
  NdiFindCreateFn findCreate=nullptr; NdiFindDestroyFn findDestroy=nullptr;
  NdiFindGetSourcesFn findGetSources=nullptr; NdiRecvCreateFn recvCreate=nullptr;
  NdiRecvDestroyFn recvDestroy=nullptr; NdiRecvCaptureFn recvCapture=nullptr;
  NdiRecvFreeVideoFn recvFreeVideo=nullptr;

  bool load() {
    if (module) return true;
    const char* env=std::getenv("VISCO_NDI_DLL");
    const char* candidates[]={"Processing.NDI.Lib.x64.dll","Processing.NDI.Lib.dll"};
    if (env && *env) module=LoadLibraryA(env);
    if (!module) for (const char* p:candidates) { module=LoadLibraryA(p); if(module) break; }
    if (!module) return false;
    auto sym=[&](const char* n)->FARPROC { return GetProcAddress(module,n); };
    initialize=reinterpret_cast<NdiInitFn>(sym("NDIlib_initialize"));
    destroy=reinterpret_cast<NdiDestroyFn>(sym("NDIlib_destroy"));
    findCreate=reinterpret_cast<NdiFindCreateFn>(sym("NDIlib_find_create_v2"));
    findDestroy=reinterpret_cast<NdiFindDestroyFn>(sym("NDIlib_find_destroy"));
    findGetSources=reinterpret_cast<NdiFindGetSourcesFn>(sym("NDIlib_find_get_current_sources"));
    recvCreate=reinterpret_cast<NdiRecvCreateFn>(sym("NDIlib_recv_create_v3"));
    recvDestroy=reinterpret_cast<NdiRecvDestroyFn>(sym("NDIlib_recv_destroy"));
    recvCapture=reinterpret_cast<NdiRecvCaptureFn>(sym("NDIlib_recv_capture_v3"));
    recvFreeVideo=reinterpret_cast<NdiRecvFreeVideoFn>(sym("NDIlib_recv_free_video_v2"));
    if(!initialize || !destroy || !findCreate || !findDestroy || !findGetSources || !recvCreate || !recvDestroy || !recvCapture || !recvFreeVideo || !initialize()) {
      FreeLibrary(module); module=nullptr; return false;
    }
    return true;
  }
  ~NdiApi() { if(destroy) destroy(); if(module) FreeLibrary(module); }
};

static std::shared_ptr<NativeVideoFrame> copyBgra(const unsigned char* data, int width, int height, int stride, long long timestamp100ns) {
  if(!data || width<=0 || height<=0 || stride==0) return {};
  auto frame=std::make_shared<NativeVideoFrame>();
  frame->width=static_cast<UINT>(width); frame->height=static_cast<UINT>(height);
  frame->timestampUs=timestamp100ns>0 ? static_cast<UINT64>(timestamp100ns/10) : 0;
  const size_t row=static_cast<size_t>(width)*4;
  frame->bgra.resize(row*static_cast<size_t>(height));
  const unsigned char* first=data;
  if(stride<0) first=data+static_cast<size_t>(height-1)*static_cast<size_t>(-stride);
  const size_t pitch=static_cast<size_t>(stride<0 ? -stride : stride);
  for(int y=0;y<height;y++) std::memcpy(frame->bgra.data()+static_cast<size_t>(y)*row, first+static_cast<ptrdiff_t>(y)*stride, row);
  (void)pitch;
  return frame;
}
}

class NetworkFrameRuntime::Impl {
public:
  OmtApi omt;
  NdiApi ndi;
};

NetworkFrameRuntime::NetworkFrameRuntime() : impl_(std::make_unique<Impl>()) {}
NetworkFrameRuntime::~NetworkFrameRuntime() { stop(); }

bool NetworkFrameRuntime::available(NetworkProtocol protocol) const {
  if(protocol==NetworkProtocol::OMT) return impl_->omt.load();
  if(protocol==NetworkProtocol::NDI) return impl_->ndi.load();
  return false;
}

std::vector<NetworkSourceInfo> NetworkFrameRuntime::discover(NetworkProtocol protocol) {
  std::vector<NetworkSourceInfo> result;
  if(protocol==NetworkProtocol::OMT) {
    if(!impl_->omt.load()) return result;
    // OMT discovery returns pointers owned by the runtime until the next discovery call.
    using DiscoverFn = char** (__cdecl*)(int*);
    auto fn=reinterpret_cast<DiscoverFn>(GetProcAddress(impl_->omt.module,"omt_discovery_getaddresses"));
    if(!fn) return result;
    int count=0; char** addresses=fn(&count);
    for(int i=0; addresses && i<count; ++i) if(addresses[i] && *addresses[i]) result.push_back({"omt-"+std::to_string(i),addresses[i],NetworkProtocol::OMT,addresses[i]});
    return result;
  }
  if(protocol==NetworkProtocol::NDI) {
    if(!impl_->ndi.load()) return result;
    NdiFindCreate settings{}; settings.show_local_sources=true;
    void* finder=impl_->ndi.findCreate(&settings);
    if(!finder) return result;
    unsigned int count=0;
    const NdiSource* sources=impl_->ndi.findGetSources(finder,&count,1000);
    for(unsigned int i=0;sources && i<count;++i) {
      const char* name=sources[i].p_ndi_name?sources[i].p_ndi_name:"";
      if(*name) result.push_back({"ndi-"+std::to_string(i),name,NetworkProtocol::NDI,name});
    }
    impl_->ndi.findDestroy(finder);
  }
  return result;
}

void NetworkFrameRuntime::start(NetworkProtocol protocol, const std::string& source) {
  stop();
  if(protocol==NetworkProtocol::None || source.empty()) throw std::runtime_error("Network protocol and source are required.");
  if(!available(protocol)) throw std::runtime_error("Requested network runtime is not installed.");
  { std::lock_guard<std::mutex> lock(mutex_); latest_.reset(); error_.clear(); }
  protocol_=protocol; source_=source; running_=true;
  thread_=std::thread([this]{loop();});
}

void NetworkFrameRuntime::stop() {
  running_=false;
  if(thread_.joinable()) thread_.join();
  protocol_=NetworkProtocol::None;
  source_.clear();
}

std::shared_ptr<const NativeVideoFrame> NetworkFrameRuntime::latest() const {
  std::lock_guard<std::mutex> lock(mutex_); return latest_;
}
std::string NetworkFrameRuntime::error() const {
  std::lock_guard<std::mutex> lock(mutex_); return error_;
}
void NetworkFrameRuntime::setError(const std::string& error) {
  std::lock_guard<std::mutex> lock(mutex_); error_=error;
}
void NetworkFrameRuntime::publish(std::shared_ptr<NativeVideoFrame> frame) {
  if(!frame) return;
  std::lock_guard<std::mutex> lock(mutex_); latest_=std::move(frame);
}

void NetworkFrameRuntime::loop() {
  try {
    if(protocol_==NetworkProtocol::OMT) {
      auto instance=impl_->omt.create(source_.c_str(), OMTFrameType_Video, 2, 0);
      if(!instance) throw std::runtime_error("OMT receiver creation failed.");
      while(running_) {
        auto* frame=impl_->omt.receive(instance, OMTFrameType_Video, 100);
        if(!frame) continue;
        if(frame->Codec==OMTCodec_BGRA) publish(copyBgra(static_cast<const unsigned char*>(frame->Data),frame->Width,frame->Height,frame->Stride,frame->Timestamp));
      }
      impl_->omt.destroy(instance);
      return;
    }
    if(protocol_==NetworkProtocol::NDI) {
      NdiRecvCreate desc{}; desc.source.p_ndi_name=source_.c_str(); desc.color_format=NdiBgrxBgra; desc.bandwidth=NdiHighest; desc.allow_video_fields=false; desc.receiver_name="VisCo";
      auto receiver=impl_->ndi.recvCreate(&desc);
      if(!receiver) throw std::runtime_error("NDI receiver creation failed.");
      while(running_) {
        NdiVideoFrame video{};
        const int type=impl_->ndi.recvCapture(receiver,&video,nullptr,nullptr,100);
        if(type==NdiVideo) {
          publish(copyBgra(video.data,video.xres,video.yres,video.stride,video.timestamp));
          impl_->ndi.recvFreeVideo(receiver,&video);
        } else if(type==NdiError) break;
      }
      impl_->ndi.recvDestroy(receiver);
      return;
    }
  } catch(const std::exception& ex) {
    setError(ex.what());
  }
  running_=false;
}
