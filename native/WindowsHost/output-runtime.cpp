#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "output-runtime.h"
#include <windows.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <wrl/client.h>
#include <cstring>
#include <stdexcept>
#include <algorithm>
#include <cstdlib>
#include <limits>

using Microsoft::WRL::ComPtr;

namespace {
enum OMTCodec { OMTCodec_BGRA = 0x41524742 };

static void requireHr(HRESULT hr, const char* message) {
  if (FAILED(hr)) throw std::runtime_error(message);
}

struct VirtualHeader {
  char magic[8];
  uint32_t version;
  uint32_t width;
  uint32_t height;
  uint32_t stride;
  uint32_t reserved;
  uint64_t frameNumber;
  uint64_t timestampUs;
};

struct OMTMediaFrame {
  int Type; long long Timestamp; int Codec; int Width; int Height; int Stride; int Flags;
  int FrameRateN; int FrameRateD; float AspectRatio; int ColorSpace;
  int SampleRate; int Channels; int SamplesPerChannel;
  void* Data; int DataLength; void* CompressedData; int CompressedLength;
  void* FrameMetadata; int FrameMetadataLength;
};

using OmtSend = long long;
using OmtCreateFn = OmtSend* (__cdecl*)(const char*, int);
using OmtDestroyFn = void (__cdecl*)(OmtSend*);
using OmtSendFrameFn = int (__cdecl*)(OmtSend*, OMTMediaFrame*);

struct OmtApi {
  HMODULE module=nullptr; OmtCreateFn create=nullptr; OmtDestroyFn destroy=nullptr; OmtSendFrameFn send=nullptr;
  bool load() {
    if(module) return true;
    const char* env=std::getenv("VISCO_OMT_DLL");
    module=LoadLibraryA(env&&*env?env:"libomt.dll");
    if(!module) return false;
    create=reinterpret_cast<OmtCreateFn>(GetProcAddress(module,"omt_send_create"));
    destroy=reinterpret_cast<OmtDestroyFn>(GetProcAddress(module,"omt_send_destroy"));
    send=reinterpret_cast<OmtSendFrameFn>(GetProcAddress(module,"omt_send"));
    if(!create||!destroy||!send){FreeLibrary(module);module=nullptr;return false;}
    return true;
  }
  ~OmtApi(){if(module)FreeLibrary(module);}
};

using NdiInitFn=bool (__cdecl*)();
using NdiDestroyFn=void (__cdecl*)();
using NdiSend=void*;
struct NdiSendCreate { const char* p_ndi_name; const char* p_groups; bool clock_video; bool clock_audio; };
struct NdiVideoFrame {
  int xres,yres,fourcc;
  int frame_rate_N,frame_rate_D;
  float aspect;
  int frame_format;
  long long timecode;
  unsigned char* data;
  int stride;
  const char* metadata;
  long long timestamp;
};
using NdiSendCreateFn=NdiSend (__cdecl*)(const NdiSendCreate*);
using NdiSendDestroyFn=void (__cdecl*)(NdiSend);
using NdiSendVideoFn=void (__cdecl*)(NdiSend,const NdiVideoFrame*);
struct NdiApi {
  HMODULE module=nullptr; NdiInitFn initialize=nullptr; NdiDestroyFn destroy=nullptr;
  NdiSendCreateFn create=nullptr; NdiSendDestroyFn sendDestroy=nullptr; NdiSendVideoFn sendVideo=nullptr;
  bool load() {
    if(module)return true;
    const char* env=std::getenv("VISCO_NDI_DLL");
    const char* candidates[]={"Processing.NDI.Lib.x64.dll","Processing.NDI.Lib.dll"};
    if(env&&*env)module=LoadLibraryA(env);
    if(!module)for(const char* p:candidates){module=LoadLibraryA(p);if(module)break;}
    if(!module)return false;
    auto sym=[&](const char*n){return GetProcAddress(module,n);};
    initialize=reinterpret_cast<NdiInitFn>(sym("NDIlib_initialize"));
    destroy=reinterpret_cast<NdiDestroyFn>(sym("NDIlib_destroy"));
    create=reinterpret_cast<NdiSendCreateFn>(sym("NDIlib_send_create"));
    sendDestroy=reinterpret_cast<NdiSendDestroyFn>(sym("NDIlib_send_destroy"));
    sendVideo=reinterpret_cast<NdiSendVideoFn>(sym("NDIlib_send_send_video_v2"));
    if(!initialize||!destroy||!create||!sendDestroy||!sendVideo||!initialize()){FreeLibrary(module);module=nullptr;return false;}
    return true;
  }
  ~NdiApi(){if(destroy)destroy();if(module)FreeLibrary(module);}
};
}

class NativeOutputRuntime::Impl {
public:
  ComPtr<IMFSinkWriter> writer;
  DWORD writerStream=0;
  UINT width=0,height=0,fps=30;
  HANDLE mapping=nullptr;
  void* mapped=nullptr;
  size_t mappingSize=0;
  OmtApi omt;
  OmtSend* omtSender=nullptr;
  NdiApi ndi;
  NdiSend ndiSender=nullptr;
  NativeStreamProtocol stream=NativeStreamProtocol::None;

  ~Impl(){
    if(writer) writer->Finalize();
    writer.Reset();
    if(mapped) UnmapViewOfFile(mapped);
    if(mapping) CloseHandle(mapping);
    if(omtSender) omt.destroy(omtSender);
    if(ndiSender) ndi.sendDestroy(ndiSender);
  }
};

NativeOutputRuntime::NativeOutputRuntime():impl_(std::make_unique<Impl>()){}
NativeOutputRuntime::~NativeOutputRuntime(){stop();}

void NativeOutputRuntime::startRecord(const std::string& path, UINT width, UINT height, UINT fps){
  try{
    if(path.empty()) throw std::runtime_error("Record path is empty.");
    if(impl_->writer){ impl_->writer->Finalize(); impl_->writer.Reset(); }
    recording_=false;
    impl_->width=width; impl_->height=height; impl_->fps=fps;
    ComPtr<IMFAttributes> attrs;
    requireHr(MFCreateAttributes(&attrs,1),"Record attributes failed");
    attrs->SetUINT32(MF_SINK_WRITER_DISABLE_THROTTLING,TRUE);
    requireHr(MFCreateSinkWriterFromURL(std::wstring(path.begin(),path.end()).c_str(),nullptr,attrs.Get(),&impl_->writer),"Create sink writer failed");

    ComPtr<IMFMediaType> outputType;
    requireHr(MFCreateMediaType(&outputType),"Record output type failed");
    outputType->SetGUID(MF_MT_MAJOR_TYPE,MFMediaType_Video);
    outputType->SetGUID(MF_MT_SUBTYPE,MFVideoFormat_H264);
    MFSetAttributeSize(outputType.Get(),MF_MT_FRAME_SIZE,width,height);
    MFSetAttributeRatio(outputType.Get(),MF_MT_FRAME_RATE,fps,1);
    MFSetAttributeRatio(outputType.Get(),MF_MT_PIXEL_ASPECT_RATIO,1,1);
    outputType->SetUINT32(MF_MT_INTERLACE_MODE,MFVideoInterlace_Progressive);
    outputType->SetUINT32(MF_MT_AVG_BITRATE,std::min<UINT>(std::numeric_limits<UINT>::max(),width*height*fps));
    requireHr(impl_->writer->AddStream(outputType.Get(),&impl_->writerStream),"Add H264 stream failed");

    ComPtr<IMFMediaType> inputType;
    requireHr(MFCreateMediaType(&inputType),"Record input type failed");
    inputType->SetGUID(MF_MT_MAJOR_TYPE,MFMediaType_Video);
    inputType->SetGUID(MF_MT_SUBTYPE,MFVideoFormat_RGB32);
    MFSetAttributeSize(inputType.Get(),MF_MT_FRAME_SIZE,width,height);
    MFSetAttributeRatio(inputType.Get(),MF_MT_FRAME_RATE,fps,1);
    MFSetAttributeRatio(inputType.Get(),MF_MT_PIXEL_ASPECT_RATIO,1,1);
    inputType->SetUINT32(MF_MT_INTERLACE_MODE,MFVideoInterlace_Progressive);
    requireHr(impl_->writer->SetInputMediaType(impl_->writerStream,inputType.Get(),nullptr),"Set H264 input type failed");
    requireHr(impl_->writer->BeginWriting(),"Begin record failed");
    recording_=true;
    error_.clear();
  }catch(const std::exception&ex){recording_=false;setError(ex.what());}
}

void NativeOutputRuntime::startVirtual(const std::string& mappingName, UINT width, UINT height, UINT fps){
  try{
    if(impl_->mapped){ UnmapViewOfFile(impl_->mapped); impl_->mapped=nullptr; }
    if(impl_->mapping){ CloseHandle(impl_->mapping); impl_->mapping=nullptr; }
    virtualOutput_=false;
    impl_->width=width; impl_->height=height; impl_->fps=fps;
    const size_t frameBytes=static_cast<size_t>(width)*height*4;
    impl_->mappingSize=sizeof(VirtualHeader)+frameBytes;
    impl_->mapping=CreateFileMappingA(INVALID_HANDLE_VALUE,nullptr,PAGE_READWRITE,static_cast<DWORD>(impl_->mappingSize>>32),static_cast<DWORD>(impl_->mappingSize&0xffffffffu),mappingName.c_str());
    if(!impl_->mapping) throw std::runtime_error("Virtual output mapping creation failed.");
    impl_->mapped=MapViewOfFile(impl_->mapping,FILE_MAP_ALL_ACCESS,0,0,impl_->mappingSize);
    if(!impl_->mapped) throw std::runtime_error("Virtual output mapping failed.");
    std::memset(impl_->mapped,0,impl_->mappingSize);
    virtualOutput_=true; error_.clear();
  }catch(const std::exception&ex){virtualOutput_=false;setError(ex.what());}
}

void NativeOutputRuntime::startStream(NativeStreamProtocol protocol,const std::string& name,UINT width,UINT height,UINT fps){
  try{
    if(impl_->omtSender){ impl_->omt.destroy(impl_->omtSender); impl_->omtSender=nullptr; }
    if(impl_->ndiSender){ impl_->ndi.sendDestroy(impl_->ndiSender); impl_->ndiSender=nullptr; }
    streaming_=false;
    if(name.empty()) throw std::runtime_error("Stream name is empty.");
    if(protocol==NativeStreamProtocol::OMT){
      if(!impl_->omt.load()) throw std::runtime_error("OMT runtime is not installed.");
      impl_->omtSender=impl_->omt.create(name.c_str(),0);
      if(!impl_->omtSender) throw std::runtime_error("OMT sender creation failed.");
    }else if(protocol==NativeStreamProtocol::NDI){
      if(!impl_->ndi.load()) throw std::runtime_error("NDI runtime is not installed.");
      NdiSendCreate desc{name.c_str(),nullptr,true,false};
      impl_->ndiSender=impl_->ndi.create(&desc);
      if(!impl_->ndiSender) throw std::runtime_error("NDI sender creation failed.");
    }else throw std::runtime_error("Stream protocol is not configured.");
    impl_->width=width;impl_->height=height;impl_->fps=fps;impl_->stream=protocol;streaming_=true;error_.clear();
  }catch(const std::exception&ex){streaming_=false;setError(ex.what());}
}

void NativeOutputRuntime::submit(const std::shared_ptr<const NativeVideoFrame>& frame,UINT64 frameNumber){
  if(!frame)return;
  try{
    if(recording_ && impl_->writer){
      const DWORD row=frame->width*4;
      const DWORD size=row*frame->height;
      ComPtr<IMFMediaBuffer> buffer;
      requireHr(MFCreateMemoryBuffer(size,&buffer),"Record buffer failed");
      BYTE* dst=nullptr; DWORD max=0,cur=0;
      requireHr(buffer->Lock(&dst,&max,&cur),"Record buffer lock failed");
      for(UINT y=0;y<frame->height;y++)std::memcpy(dst+y*row,frame->bgra.data()+static_cast<size_t>(y)*row,row);
      buffer->Unlock(); buffer->SetCurrentLength(size);
      ComPtr<IMFSample> sample; requireHr(MFCreateSample(&sample),"Record sample failed");
      sample->AddBuffer(buffer.Get());
      const LONGLONG duration=10000000LL/impl_->fps;
      sample->SetSampleTime(static_cast<LONGLONG>(frameNumber)*duration);
      sample->SetSampleDuration(duration);
      requireHr(impl_->writer->WriteSample(impl_->writerStream,sample.Get()),"Record frame write failed");
    }
    if(virtualOutput_ && impl_->mapped){
      auto* header=static_cast<VirtualHeader*>(impl_->mapped);
      std::memcpy(header->magic,"VISCOOUT",8);header->version=1;header->width=frame->width;header->height=frame->height;header->stride=frame->width*4;header->frameNumber=frameNumber;header->timestampUs=frame->timestampUs;
      std::memcpy(static_cast<unsigned char*>(impl_->mapped)+sizeof(VirtualHeader),frame->bgra.data(),frame->bgra.size());
      MemoryBarrier();
    }
    if(streaming_){
      if(impl_->stream==NativeStreamProtocol::OMT && impl_->omtSender){
        OMTMediaFrame out{};out.Type=2;out.Timestamp=-1;out.Codec=OMTCodec_BGRA;out.Width=static_cast<int>(frame->width);out.Height=static_cast<int>(frame->height);out.Stride=static_cast<int>(frame->width*4);out.FrameRateN=static_cast<int>(impl_->fps);out.FrameRateD=1;out.AspectRatio=static_cast<float>(frame->width)/static_cast<float>(frame->height);out.Data=const_cast<unsigned char*>(frame->bgra.data());out.DataLength=static_cast<int>(frame->bgra.size());impl_->omt.send(impl_->omtSender,&out);
      }else if(impl_->stream==NativeStreamProtocol::NDI && impl_->ndiSender){
        NdiVideoFrame out{};out.xres=static_cast<int>(frame->width);out.yres=static_cast<int>(frame->height);out.fourcc=0x41524742;out.frame_rate_N=static_cast<int>(impl_->fps);out.frame_rate_D=1;out.aspect=static_cast<float>(frame->width)/static_cast<float>(frame->height);out.frame_format=1;out.timecode=static_cast<long long>(frameNumber)*10000000LL/impl_->fps;out.data=const_cast<unsigned char*>(frame->bgra.data());out.stride=static_cast<int>(frame->width*4);impl_->ndi.sendVideo(impl_->ndiSender,&out);
      }
    }
  }catch(const std::exception&ex){setError(ex.what());}
}

void NativeOutputRuntime::stop(){
  if(!impl_)return;
  if(recording_&&impl_->writer){impl_->writer->Finalize();impl_->writer.Reset();}
  if(impl_->mapped){UnmapViewOfFile(impl_->mapped);impl_->mapped=nullptr;}
  if(impl_->mapping){CloseHandle(impl_->mapping);impl_->mapping=nullptr;}
  if(impl_->omtSender){impl_->omt.destroy(impl_->omtSender);impl_->omtSender=nullptr;}
  if(impl_->ndiSender){impl_->ndi.sendDestroy(impl_->ndiSender);impl_->ndiSender=nullptr;}
  recording_=virtualOutput_=streaming_=false;impl_->stream=NativeStreamProtocol::None;
}
