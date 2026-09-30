#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "capture-runtime.h"
#include <mferror.h>
#include <ks.h>
#include <ksmedia.h>
#include <chrono>
#include <sstream>
#include <stdexcept>
#include <algorithm>
#include <cstring>
#include <cmath>
#include <utility>

static void requireHr(HRESULT hr, const char* message) {
  if (FAILED(hr)) throw std::runtime_error(message);
}

MediaFoundationHost::MediaFoundationHost() { requireHr(MFStartup(MF_VERSION, MFSTARTUP_FULL), "MFStartup failed"); }
MediaFoundationHost::~MediaFoundationHost() { MFShutdown(); }

std::vector<MediaFoundationHost::VideoDeviceInfo> MediaFoundationHost::enumerateVideoDeviceInfo() {
  ComPtr<IMFAttributes> attrs;
  requireHr(MFCreateAttributes(&attrs, 1), "MFCreateAttributes failed");
  requireHr(attrs->SetGUID(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE, MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_GUID), "MF device attrs failed");
  IMFActivate** devices=nullptr; UINT32 count=0;
  requireHr(MFEnumDeviceSources(attrs.Get(), &devices, &count), "MFEnumDeviceSources failed");
  std::vector<VideoDeviceInfo> result;
  for(UINT32 i=0;i<count;i++){
    WCHAR* name=nullptr; UINT32 nameLength=0; WCHAR* link=nullptr; UINT32 linkLength=0; GUID category{};
    const HRESULT catHr=devices[i]->GetGUID(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_CATEGORY,&category);
    if(SUCCEEDED(devices[i]->GetAllocatedString(MF_DEVSOURCE_ATTRIBUTE_FRIENDLY_NAME,&name,&nameLength))){
      devices[i]->GetAllocatedString(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_SYMBOLIC_LINK,&link,&linkLength);
      result.push_back({std::wstring(name,nameLength),link?std::wstring(link,linkLength):L"",SUCCEEDED(catHr)&&IsEqualGUID(category,KSCATEGORY_VIDEO_CAMERA)});
    }
    if(name)CoTaskMemFree(name); if(link)CoTaskMemFree(link); devices[i]->Release();
  }
  CoTaskMemFree(devices); return result;
}
std::vector<std::wstring> MediaFoundationHost::enumerateVideoDevices(){
  std::vector<std::wstring> result; for(const auto& item:enumerateVideoDeviceInfo()) result.push_back(item.name); return result;
}
ComPtr<IMFMediaSource> MediaFoundationHost::createSource(const std::wstring& symbolicLink) {
  ComPtr<IMFAttributes> attrs;
  requireHr(MFCreateAttributes(&attrs, 2), "MFCreateAttributes failed");
  requireHr(attrs->SetGUID(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE, MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_GUID), "Set video source type failed");
  requireHr(attrs->SetString(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_SYMBOLIC_LINK, symbolicLink.c_str()), "Set video symbolic link failed");
  ComPtr<IMFMediaSource> source;
  requireHr(MFCreateDeviceSource(attrs.Get(), &source), "MFCreateDeviceSource failed");
  return source;
}

static UINT64 sampleTimeUs(IMFSample* sample) {
  LONGLONG hns = 0;
  if (FAILED(sample->GetSampleTime(&hns))) return 0;
  return static_cast<UINT64>(hns / 10);
}

MediaCaptureHost::MediaCaptureHost(MediaFoundationHost& media) : media_(media) {}
MediaCaptureHost::~MediaCaptureHost() { stop(); }

void MediaCaptureHost::start(const std::wstring& symbolicLink, UINT width, UINT height, UINT fps) {
  stop();
  {
    std::lock_guard<std::mutex> lock(mutex_);
    latest_.reset();
    error_.clear();
  }
  running_ = true;
  thread_ = std::thread([this, symbolicLink, width, height, fps] { loop(symbolicLink, width, height, fps); });
}

void MediaCaptureHost::stop() {
  running_ = false;
  if (thread_.joinable()) thread_.join();
}

std::shared_ptr<const NativeVideoFrame> MediaCaptureHost::latest() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return latest_;
}

std::string MediaCaptureHost::error() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return error_;
}

void MediaCaptureHost::loop(std::wstring symbolicLink, UINT width, UINT height, UINT fps) {
  HRESULT co = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  try {
    auto source = media_.createSource(symbolicLink);

    ComPtr<IMFAttributes> readerAttrs;
    requireHr(MFCreateAttributes(&readerAttrs, 2), "Reader attributes failed");
    readerAttrs->SetUINT32(MF_SOURCE_READER_ENABLE_ADVANCED_VIDEO_PROCESSING, TRUE);
    readerAttrs->SetUINT32(MF_SOURCE_READER_DISABLE_DXVA, FALSE);

    ComPtr<IMFSourceReader> reader;
    requireHr(MFCreateSourceReaderFromMediaSource(source.Get(), readerAttrs.Get(), &reader), "MFCreateSourceReaderFromMediaSource failed");

    ComPtr<IMFMediaType> type;
    requireHr(MFCreateMediaType(&type), "MFCreateMediaType failed");
    requireHr(type->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video), "Set major type failed");
    requireHr(type->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_RGB32), "Set RGB32 failed");
    requireHr(MFSetAttributeSize(type.Get(), MF_MT_FRAME_SIZE, width, height), "Set frame size failed");
    requireHr(MFSetAttributeRatio(type.Get(), MF_MT_FRAME_RATE, fps, 1), "Set frame rate failed");
    requireHr(type->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive), "Set interlace failed");

    HRESULT setType = reader->SetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM, nullptr, type.Get());
    if (FAILED(setType)) {
      // Some devices reject an exact requested mode. Let MF select the native mode,
      // then force RGB32 only. This keeps device startup resilient.
      ComPtr<IMFMediaType> fallback;
      requireHr(MFCreateMediaType(&fallback), "Fallback media type failed");
      requireHr(fallback->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video), "Fallback major type failed");
      requireHr(fallback->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_RGB32), "Fallback RGB32 failed");
      requireHr(reader->SetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM, nullptr, fallback.Get()), "Fallback media type rejected");
    }

    reader->SetStreamSelection(MF_SOURCE_READER_FIRST_AUDIO_STREAM, FALSE);
    reader->SetStreamSelection(MF_SOURCE_READER_FIRST_VIDEO_STREAM, TRUE);

    while (running_) {
      DWORD streamIndex = 0, flags = 0;
      LONGLONG timestamp = 0;
      ComPtr<IMFSample> sample;
      HRESULT hr = reader->ReadSample(MF_SOURCE_READER_FIRST_VIDEO_STREAM, 0, &streamIndex, &flags, &timestamp, &sample);
      if (FAILED(hr)) throw std::runtime_error("IMFSourceReader::ReadSample failed");
      if (flags & MF_SOURCE_READERF_ENDOFSTREAM) break;
      if (!sample) continue;

      ComPtr<IMFMediaBuffer> buffer;
      requireHr(sample->ConvertToContiguousBuffer(&buffer), "ConvertToContiguousBuffer failed");

      UINT frameWidth = width, frameHeight = height;
      LONG defaultStride = static_cast<LONG>(frameWidth * 4);
      ComPtr<IMFMediaType> currentType;
      if (SUCCEEDED(reader->GetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM, &currentType))) {
        MFGetAttributeSize(currentType.Get(), MF_MT_FRAME_SIZE, &frameWidth, &frameHeight);
        UINT32 rawStride = 0;
        if (SUCCEEDED(currentType->GetUINT32(MF_MT_DEFAULT_STRIDE, &rawStride))) defaultStride = static_cast<LONG>(rawStride);
      }

      BYTE* scanline0 = nullptr;
      LONG stride = defaultStride;
      ComPtr<IMF2DBuffer> buffer2d;
      const bool has2d = SUCCEEDED(buffer.As(&buffer2d));
      bool locked2d = false;
      BYTE* data = nullptr;
      DWORD maxLen = 0, currentLen = 0;
      if (has2d) {
        locked2d = SUCCEEDED(buffer2d->Lock2D(&scanline0, &stride));
      }
      if (!locked2d) {
        requireHr(buffer->Lock(&data, &maxLen, &currentLen), "Media buffer lock failed");
        scanline0 = data;
        stride = defaultStride;
        if (stride < 0) scanline0 = data + static_cast<size_t>(-stride) * (frameHeight - 1);
      } else {
        // Lock2D exposes the actual pitch; contiguous bytes are not necessarily
        // exactly width*4 because a surface may contain row padding.
        currentLen = static_cast<DWORD>(std::min<size_t>(
          static_cast<size_t>(frameHeight) * static_cast<size_t>(stride < 0 ? -stride : stride),
          static_cast<size_t>(0xffffffffu)));
      }

      const size_t rowBytes = static_cast<size_t>(frameWidth) * 4;
      const size_t absStride = static_cast<size_t>(stride < 0 ? -stride : stride);
      const size_t required = rowBytes * frameHeight;
      if (absStride >= rowBytes && currentLen >= absStride * frameHeight) {
        auto frame = std::make_shared<NativeVideoFrame>();
        frame->width = frameWidth;
        frame->height = frameHeight;
        frame->timestampUs = sampleTimeUs(sample.Get());
        frame->bgra.resize(required);
        for (UINT y=0; y<frameHeight; ++y) {
          const BYTE* sourceRow = scanline0 + static_cast<ptrdiff_t>(y) * stride;
          memcpy(frame->bgra.data() + static_cast<size_t>(y) * rowBytes, sourceRow, rowBytes);
        }
        {
          std::lock_guard<std::mutex> lock(mutex_);
          latest_ = std::move(frame);
        }
      }
      if (locked2d) buffer2d->Unlock2D();
      else buffer->Unlock();


    }
    source->Shutdown();
  } catch (const std::exception& ex) {
    std::lock_guard<std::mutex> lock(mutex_);
    error_ = ex.what();
  }
  running_ = false;
  if (SUCCEEDED(co)) CoUninitialize();
}

void D3D11Host::initialize(HWND hwnd, UINT width, UINT height) {
  UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;
  D3D_FEATURE_LEVEL level{};
  requireHr(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, flags, nullptr, 0, D3D11_SDK_VERSION,
    &device_, &level, &context_), "D3D11CreateDevice failed");

  ComPtr<IDXGIDevice> dxgiDevice;
  requireHr(device_.As(&dxgiDevice), "IDXGIDevice query failed");
  ComPtr<IDXGIAdapter> adapter;
  requireHr(dxgiDevice->GetAdapter(&adapter), "IDXGIAdapter failed");
  ComPtr<IDXGIFactory2> factory;
  requireHr(adapter->GetParent(IID_PPV_ARGS(&factory)), "IDXGIFactory2 failed");

  DXGI_SWAP_CHAIN_DESC1 desc{};
  desc.Width = width; desc.Height = height; desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  desc.SampleDesc.Count = 1; desc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
  desc.BufferCount = 2; desc.SwapEffect = DXGI_SWAP_EFFECT_FLIP_DISCARD;
  requireHr(factory->CreateSwapChainForHwnd(device_.Get(), hwnd, &desc, nullptr, nullptr, &swap_), "SwapChain creation failed");
  initializeShaders();
  resizeTarget(width, height);
}

void D3D11Host::initializeShaders() {
  const char* shader = R"(
cbuffer Transform : register(b0) {
  float4 rect;
  float4 rotation;
  float4 scaleOpacity;
  float4 outputSize;
  float4 crop;
};
struct VSIn { float2 pos : POSITION; float2 uv : TEXCOORD0; };
struct VSOut { float4 pos : SV_Position; float2 uv : TEXCOORD0; };
VSOut vs(VSIn input) {
  float2 ndc = float2(input.pos.x / outputSize.x * 2.0 - 1.0, 1.0 - input.pos.y / outputSize.y * 2.0);
  VSOut o; o.pos=float4(ndc,0,1);
  o.uv=float2(lerp(crop.x,1.0-crop.z,input.uv.x),lerp(crop.y,1.0-crop.w,input.uv.y)); return o;
}
Texture2D tex0 : register(t0);
SamplerState samp0 : register(s0);
float4 ps(VSOut input) : SV_Target { float4 c=tex0.Sample(samp0,input.uv); c.a*=saturate(scaleOpacity.z); return c; }
)";
  ComPtr<ID3DBlob> vsBlob, psBlob, errors;
  requireHr(D3DCompile(shader, strlen(shader), "visco-compositor", nullptr, nullptr, "vs", "vs_5_0", 0, 0, &vsBlob, &errors), "Vertex shader compile failed");
  requireHr(D3DCompile(shader, strlen(shader), "visco-compositor", nullptr, nullptr, "ps", "ps_5_0", 0, 0, &psBlob, &errors), "Pixel shader compile failed");
  requireHr(device_->CreateVertexShader(vsBlob->GetBufferPointer(), vsBlob->GetBufferSize(), nullptr, &vertexShader_), "Vertex shader creation failed");
  requireHr(device_->CreatePixelShader(psBlob->GetBufferPointer(), psBlob->GetBufferSize(), nullptr, &pixelShader_), "Pixel shader creation failed");
  const D3D11_INPUT_ELEMENT_DESC layout[]={{"POSITION",0,DXGI_FORMAT_R32G32_FLOAT,0,0,D3D11_INPUT_PER_VERTEX_DATA,0},{"TEXCOORD",0,DXGI_FORMAT_R32G32_FLOAT,0,8,D3D11_INPUT_PER_VERTEX_DATA,0}};
  requireHr(device_->CreateInputLayout(layout,2,vsBlob->GetBufferPointer(),vsBlob->GetBufferSize(),&inputLayout_),"Input layout creation failed");
  D3D11_BUFFER_DESC cb{}; cb.ByteWidth=80; cb.Usage=D3D11_USAGE_DYNAMIC; cb.BindFlags=D3D11_BIND_CONSTANT_BUFFER; cb.CPUAccessFlags=D3D11_CPU_ACCESS_WRITE;
  requireHr(device_->CreateBuffer(&cb,nullptr,&transformBuffer_),"Transform buffer creation failed");
  D3D11_BUFFER_DESC geometry{}; geometry.ByteWidth=sizeof(float)*4*6; geometry.Usage=D3D11_USAGE_DYNAMIC; geometry.BindFlags=D3D11_BIND_VERTEX_BUFFER; geometry.CPUAccessFlags=D3D11_CPU_ACCESS_WRITE;
  requireHr(device_->CreateBuffer(&geometry,nullptr,&geometryVertexBuffer_),"Geometry vertex buffer creation failed");
  D3D11_BLEND_DESC blend{}; blend.RenderTarget[0].BlendEnable=TRUE; blend.RenderTarget[0].SrcBlend=D3D11_BLEND_SRC_ALPHA; blend.RenderTarget[0].DestBlend=D3D11_BLEND_INV_SRC_ALPHA; blend.RenderTarget[0].BlendOp=D3D11_BLEND_OP_ADD; blend.RenderTarget[0].SrcBlendAlpha=D3D11_BLEND_ONE; blend.RenderTarget[0].DestBlendAlpha=D3D11_BLEND_INV_SRC_ALPHA; blend.RenderTarget[0].BlendOpAlpha=D3D11_BLEND_OP_ADD; blend.RenderTarget[0].RenderTargetWriteMask=D3D11_COLOR_WRITE_ENABLE_ALL;
  requireHr(device_->CreateBlendState(&blend,&blendState_),"Blend state creation failed");
  D3D11_SAMPLER_DESC sampler{}; sampler.Filter=D3D11_FILTER_MIN_MAG_MIP_LINEAR; sampler.AddressU=sampler.AddressV=sampler.AddressW=D3D11_TEXTURE_ADDRESS_CLAMP;
  requireHr(device_->CreateSamplerState(&sampler,&sampler_),"Sampler creation failed");
}

void D3D11Host::resizeTarget(UINT width, UINT height) {
  if (!swap_) return;
  target_.Reset();
  requireHr(swap_->ResizeBuffers(0, width, height, DXGI_FORMAT_UNKNOWN, 0), "ResizeBuffers failed");
  ComPtr<ID3D11Texture2D> back;
  requireHr(swap_->GetBuffer(0, IID_PPV_ARGS(&back)), "Backbuffer query failed");
  requireHr(device_->CreateRenderTargetView(back.Get(), nullptr, &target_), "RTV creation failed");
}

void D3D11Host::ensureVideoTexture(UINT width, UINT height) {
  if (videoTexture_ && width == videoWidth_ && height == videoHeight_) return;
  videoTexture_.Reset(); videoView_.Reset();
  D3D11_TEXTURE2D_DESC desc{};
  desc.Width=width; desc.Height=height; desc.MipLevels=1; desc.ArraySize=1;
  desc.Format=DXGI_FORMAT_B8G8R8A8_UNORM; desc.SampleDesc.Count=1;
  desc.Usage=D3D11_USAGE_DYNAMIC; desc.BindFlags=D3D11_BIND_SHADER_RESOURCE; desc.CPUAccessFlags=D3D11_CPU_ACCESS_WRITE;
  requireHr(device_->CreateTexture2D(&desc, nullptr, &videoTexture_), "Video texture creation failed");
  requireHr(device_->CreateShaderResourceView(videoTexture_.Get(), nullptr, &videoView_), "Video SRV creation failed");
  videoWidth_=width; videoHeight_=height;
}

std::shared_ptr<const NativeVideoFrame> D3D11Host::render(const std::shared_ptr<const NativeVideoFrame>& frame) {
  if (frame) {
    ensureVideoTexture(frame->width, frame->height);
    D3D11_MAPPED_SUBRESOURCE mapped{};
    if (SUCCEEDED(context_->Map(videoTexture_.Get(), 0, D3D11_MAP_WRITE_DISCARD, 0, &mapped))) {
      const size_t rowBytes = static_cast<size_t>(frame->width) * 4;
      for (UINT y=0;y<frame->height;y++) {
        memcpy(static_cast<unsigned char*>(mapped.pData) + y*mapped.RowPitch,
               frame->bgra.data() + y*rowBytes, rowBytes);
      }
      context_->Unmap(videoTexture_.Get(), 0);
    }
  }
  if (!target_) return nullptr;
  context_->OMSetRenderTargets(1, target_.GetAddressOf(), nullptr);
  D3D11_VIEWPORT viewport{};
  ComPtr<ID3D11Resource> backResource;
  target_->GetResource(&backResource);
  ComPtr<ID3D11Texture2D> backTexture; backResource.As(&backTexture);
  D3D11_TEXTURE2D_DESC backDesc{}; backTexture->GetDesc(&backDesc);
  viewport.Width=static_cast<float>(backDesc.Width); viewport.Height=static_cast<float>(backDesc.Height);
  viewport.MinDepth=0; viewport.MaxDepth=1;
  context_->RSSetViewports(1, &viewport);
  const float clear[4]={0,0,0,1}; context_->ClearRenderTargetView(target_.Get(), clear);
  if (!videoView_) { swap_->Present(0,0); return nullptr; }
  UINT stride=0, offset=0;
  context_->IASetVertexBuffers(0,0,nullptr,&stride,&offset);
  context_->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
  context_->VSSetShader(vertexShader_.Get(),nullptr,0);
  context_->PSSetShader(pixelShader_.Get(),nullptr,0);
  context_->PSSetShaderResources(0,1,videoView_.GetAddressOf());
  context_->PSSetSamplers(0,1,sampler_.GetAddressOf());
  context_->Draw(3,0);
  ID3D11ShaderResourceView* nullSrv=nullptr;
  context_->PSSetShaderResources(0,1,&nullSrv);

  // The backbuffer is the canonical final GPU frame. Read it back once so
  // Record/Virtual/NDI/OMT can consume exactly the pixels shown on Program.
  ComPtr<ID3D11Resource> backResource;
  target_->GetResource(&backResource);
  ComPtr<ID3D11Texture2D> backTexture;
  requireHr(backResource.As(&backTexture), "Backbuffer texture query failed");
  D3D11_TEXTURE2D_DESC backDesc{};
  backTexture->GetDesc(&backDesc);
  if (readbackTexture_) {
    D3D11_TEXTURE2D_DESC existing{};
    readbackTexture_->GetDesc(&existing);
    if (existing.Width != backDesc.Width || existing.Height != backDesc.Height) readbackTexture_.Reset();
  }
  if (!readbackTexture_) {
    D3D11_TEXTURE2D_DESC staging = backDesc;
    staging.Usage = D3D11_USAGE_STAGING;
    staging.BindFlags = 0;
    staging.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
    staging.MiscFlags = 0;
    requireHr(device_->CreateTexture2D(&staging, nullptr, &readbackTexture_), "Final frame staging texture failed");
  }
  context_->CopyResource(readbackTexture_.Get(), backTexture.Get());
  D3D11_MAPPED_SUBRESOURCE mapped{};
  requireHr(context_->Map(readbackTexture_.Get(), 0, D3D11_MAP_READ, 0, &mapped), "Final frame readback failed");
  auto finalFrame = std::make_shared<NativeVideoFrame>();
  finalFrame->width = backDesc.Width;
  finalFrame->height = backDesc.Height;
  finalFrame->bgra.resize(static_cast<size_t>(finalFrame->width) * finalFrame->height * 4);
  const size_t rowBytes = static_cast<size_t>(finalFrame->width) * 4;
  for (UINT y = 0; y < finalFrame->height; ++y) {
    std::memcpy(finalFrame->bgra.data() + static_cast<size_t>(y) * rowBytes,
                static_cast<const unsigned char*>(mapped.pData) + static_cast<size_t>(y) * mapped.RowPitch,
                rowBytes);
  }
  context_->Unmap(readbackTexture_.Get(), 0);
  finalFrame->timestampUs = frame ? frame->timestampUs : 0;

  swap_->Present(0,0);
  {
    std::lock_guard<std::mutex> lock(finalMutex_);
    latestFinal_ = finalFrame;
  }
  return finalFrame;
}

std::shared_ptr<const NativeVideoFrame> D3D11Host::renderComposition(const std::vector<NativeRenderLayer>& layers) {
  if (!target_ || layers.empty()) return nullptr;
  ComPtr<ID3D11Resource> backResource; target_->GetResource(&backResource);
  ComPtr<ID3D11Texture2D> backTexture; requireHr(backResource.As(&backTexture),"Backbuffer texture query failed");
  D3D11_TEXTURE2D_DESC backDesc{}; backTexture->GetDesc(&backDesc);
  context_->OMSetRenderTargets(1,target_.GetAddressOf(),nullptr);
  D3D11_VIEWPORT viewport{}; viewport.Width=(float)backDesc.Width; viewport.Height=(float)backDesc.Height; viewport.MinDepth=0; viewport.MaxDepth=1; context_->RSSetViewports(1,&viewport);
  const float clear[4]={0,0,0,1}; context_->ClearRenderTargetView(target_.Get(),clear);
  std::vector<NativeRenderLayer> ordered; ordered.reserve(layers.size());
  for(const auto& layer:layers) if(layer.frame && !layer.frame->bgra.empty()) ordered.push_back(layer);
  std::sort(ordered.begin(),ordered.end(),[](const auto& a,const auto& b){return a.order<b.order;});
  context_->IASetInputLayout(inputLayout_.Get()); context_->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
  context_->VSSetShader(vertexShader_.Get(),nullptr,0); context_->PSSetShader(pixelShader_.Get(),nullptr,0); context_->PSSetSamplers(0,1,sampler_.GetAddressOf()); context_->OMSetBlendState(blendState_.Get(),nullptr,0xffffffffu);
  struct CB {float rect[4];float rotation[4];float scaleOpacity[4];float outputSize[4];float crop[4];} cb{}; cb.outputSize[0]=(float)backDesc.Width; cb.outputSize[1]=(float)backDesc.Height;
  struct Vertex {float x,y,u,v;};
  for(const auto& layer:ordered){
    ensureVideoTexture(layer.frame->width,layer.frame->height);
    D3D11_MAPPED_SUBRESOURCE mapped{}; if(FAILED(context_->Map(videoTexture_.Get(),0,D3D11_MAP_WRITE_DISCARD,0,&mapped))) continue;
    const size_t rowBytes=(size_t)layer.frame->width*4;
    for(UINT y=0;y<layer.frame->height;++y) memcpy((unsigned char*)mapped.pData+(size_t)y*mapped.RowPitch,layer.frame->bgra.data()+(size_t)y*rowBytes,rowBytes);
    context_->Unmap(videoTexture_.Get(),0);
    std::array<Vertex,6> vertices{};
    if(layer.mappingMode=="corner-pin"){
      const float* p=layer.mappingPoints.data();
      vertices={{{p[0],p[1],0,0},{p[2],p[3],1,0},{p[4],p[5],1,1},{p[0],p[1],0,0},{p[4],p[5],1,1},{p[6],p[7],0,1}}};
    } else {
      const float cx=layer.x+layer.width*0.5f, cy=layer.y+layer.height*0.5f, sx=layer.scaleX, sy=layer.scaleY, r=layer.rotation*3.14159265358979323846f/180.0f, cc=std::cos(r), ss=std::sin(r);
      const auto tp=[&](float px,float py){float lx=(px-cx)*sx,ly=(py-cy)*sy;return std::pair<float,float>{cx+lx*cc-ly*ss,cy+lx*ss+ly*cc};};
      const auto a=tp(layer.x,layer.y),b=tp(layer.x+layer.width,layer.y),d=tp(layer.x,layer.y+layer.height),e2=tp(layer.x+layer.width,layer.y+layer.height);
      vertices={{{a.first,a.second,0,0},{b.first,b.second,1,0},{e2.first,e2.second,1,1},{a.first,a.second,0,0},{e2.first,e2.second,1,1},{d.first,d.second,0,1}}};
    }
    D3D11_MAPPED_SUBRESOURCE gm{}; if(FAILED(context_->Map(geometryVertexBuffer_.Get(),0,D3D11_MAP_WRITE_DISCARD,0,&gm))) continue; memcpy(gm.pData,vertices.data(),sizeof(vertices)); context_->Unmap(geometryVertexBuffer_.Get(),0);
    UINT stride=sizeof(Vertex),offset=0; ID3D11Buffer* vb=geometryVertexBuffer_.Get(); context_->IASetVertexBuffers(0,1,&vb,&stride,&offset);
    cb.rect[0]=layer.x;cb.rect[1]=layer.y;cb.rect[2]=layer.width;cb.rect[3]=layer.height; cb.rotation[0]=r; cb.scaleOpacity[0]=layer.scaleX;cb.scaleOpacity[1]=layer.scaleY;cb.scaleOpacity[2]=layer.opacity;
    cb.crop[0]=std::clamp(layer.cropLeft,0.0f,1.0f);cb.crop[1]=std::clamp(layer.cropTop,0.0f,1.0f);cb.crop[2]=std::clamp(layer.cropRight,0.0f,1.0f);cb.crop[3]=std::clamp(layer.cropBottom,0.0f,1.0f);
    D3D11_MAPPED_SUBRESOURCE cm{}; if(FAILED(context_->Map(transformBuffer_.Get(),0,D3D11_MAP_WRITE_DISCARD,0,&cm))) continue; memcpy(cm.pData,&cb,sizeof(cb)); context_->Unmap(transformBuffer_.Get(),0);
    context_->VSSetConstantBuffers(0,1,transformBuffer_.GetAddressOf()); context_->PSSetConstantBuffers(0,1,transformBuffer_.GetAddressOf()); context_->PSSetShaderResources(0,1,videoView_.GetAddressOf()); context_->Draw(6,0); ID3D11ShaderResourceView* nullSrv=nullptr; context_->PSSetShaderResources(0,1,&nullSrv);
  }
  context_->OMSetBlendState(nullptr,nullptr,0xffffffffu);
  if(readbackTexture_){D3D11_TEXTURE2D_DESC ex{};readbackTexture_->GetDesc(&ex);if(ex.Width!=backDesc.Width||ex.Height!=backDesc.Height)readbackTexture_.Reset();}
  if(!readbackTexture_){D3D11_TEXTURE2D_DESC st=backDesc;st.Usage=D3D11_USAGE_STAGING;st.BindFlags=0;st.CPUAccessFlags=D3D11_CPU_ACCESS_READ;st.MiscFlags=0;requireHr(device_->CreateTexture2D(&st,nullptr,&readbackTexture_),"Final frame staging texture failed");}
  context_->CopyResource(readbackTexture_.Get(),backTexture.Get()); D3D11_MAPPED_SUBRESOURCE rb{}; requireHr(context_->Map(readbackTexture_.Get(),0,D3D11_MAP_READ,0,&rb),"Final frame readback failed");
  auto finalFrame=std::make_shared<NativeVideoFrame>(); finalFrame->width=backDesc.Width;finalFrame->height=backDesc.Height;finalFrame->bgra.resize((size_t)finalFrame->width*finalFrame->height*4); const size_t rowBytes2=(size_t)finalFrame->width*4;
  for(UINT y=0;y<finalFrame->height;++y) memcpy(finalFrame->bgra.data()+(size_t)y*rowBytes2,(const unsigned char*)rb.pData+(size_t)y*rb.RowPitch,rowBytes2);
  context_->Unmap(readbackTexture_.Get(),0); finalFrame->timestampUs=ordered.back().frame->timestampUs; swap_->Present(0,0); {std::lock_guard<std::mutex> lock(finalMutex_);latestFinal_=finalFrame;} return finalFrame;
}

std::shared_ptr<const NativeVideoFrame> D3D11Host::latestFinal() const {
  std::lock_guard<std::mutex> lock(finalMutex_);
  return latestFinal_;
}

MjpegPreviewServer::~MjpegPreviewServer() {
  running_=false;
  if(listener_!=INVALID_SOCKET){ closesocket(listener_); listener_=INVALID_SOCKET; }
  if(thread_.joinable()) thread_.join();
  if(wic_) wic_.Reset();
  WSACleanup();
}

void MjpegPreviewServer::start(unsigned short port) {
  requireHr(CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&wic_)), "WIC factory failed");
  WSADATA data{}; requireHr(WSAStartup(MAKEWORD(2,2), &data), "WSAStartup failed");
  listener_=socket(AF_INET,SOCK_STREAM,IPPROTO_TCP);
  if(listener_==INVALID_SOCKET) throw std::runtime_error("Preview socket failed");
  sockaddr_in address{}; address.sin_family=AF_INET; address.sin_addr.s_addr=htonl(INADDR_LOOPBACK); address.sin_port=htons(port);
  if(bind(listener_,reinterpret_cast<sockaddr*>(&address),sizeof(address))!=0 || listen(listener_,4)!=0)
    throw std::runtime_error("Preview bind/listen failed");
  running_=true;
  thread_=std::thread([this]{loop();});
}

void MjpegPreviewServer::loop() {
  while(running_) {
    sockaddr_in addr{}; int len=sizeof(addr);
    SOCKET client=accept(listener_,reinterpret_cast<sockaddr*>(&addr),&len);
    if(client==INVALID_SOCKET){ Sleep(10); continue; }
    std::thread([this,client]{streamClient(client);}).detach();
  }
}

bool MjpegPreviewServer::sendAll(SOCKET client,const void* data,size_t size) {
  const char* p=static_cast<const char*>(data);
  while(size>0){
    int n=send(client,p,static_cast<int>(std::min<size_t>(size,1<<20)),0);
    if(n<=0)return false; p+=n; size-=static_cast<size_t>(n);
  }
  return true;
}

std::vector<unsigned char> MjpegPreviewServer::encodeJpeg(const NativeVideoFrame& frame) {
  ComPtr<IWICBitmap> bitmap;
  requireHr(wic_->CreateBitmapFromMemory(frame.width,frame.height,GUID_WICPixelFormat32bppBGRA,
    frame.width*4, static_cast<UINT>(frame.bgra.size()), const_cast<BYTE*>(frame.bgra.data()), &bitmap), "WIC bitmap failed");
  ComPtr<IWICStream> stream;
  requireHr(wic_->CreateStream(&stream), "WIC stream failed");
  requireHr(stream->InitializeFromMemory(const_cast<BYTE*>(frame.bgra.data()), static_cast<DWORD>(frame.bgra.size())), "WIC memory stream failed");
  ComPtr<IWICBitmapEncoder> encoder;
  requireHr(wic_->CreateEncoder(GUID_ContainerFormatJpeg,nullptr,&encoder), "JPEG encoder failed");
  ComPtr<IWICStream> output;
  requireHr(wic_->CreateStream(&output), "WIC output stream failed");
  // Use a growable IStream instead of the source buffer.
  HGLOBAL hMem=GlobalAlloc(GMEM_MOVEABLE,1);
  if(!hMem) throw std::runtime_error("JPEG memory allocation failed");
  ComPtr<IStream> comStream;
  requireHr(CreateStreamOnHGlobal(hMem,TRUE,&comStream), "CreateStreamOnHGlobal failed");
  requireHr(encoder->Initialize(comStream.Get(),WICBitmapEncoderNoCache), "JPEG encoder init failed");
  ComPtr<IWICBitmapFrameEncode> frameEncode;
  ComPtr<IPropertyBag2> options;
  requireHr(encoder->CreateNewFrame(&frameEncode,&options), "JPEG frame creation failed");
  requireHr(frameEncode->Initialize(options.Get()), "JPEG frame init failed");
  requireHr(frameEncode->SetSize(frame.width,frame.height), "JPEG size failed");
  WICPixelFormatGUID fmt=GUID_WICPixelFormat24bppBGR;
  requireHr(frameEncode->SetPixelFormat(&fmt), "JPEG pixel format failed");
  requireHr(frameEncode->WriteSource(bitmap.Get(),nullptr), "JPEG write failed");
  requireHr(frameEncode->Commit(), "JPEG frame commit failed");
  requireHr(encoder->Commit(), "JPEG encoder commit failed");
  STATSTG stat{}; requireHr(comStream->Stat(&stat,STATFLAG_NONAME), "JPEG stream stat failed");
  LARGE_INTEGER zero{}; requireHr(comStream->Seek(zero,STREAM_SEEK_SET,nullptr), "JPEG seek failed");
  std::vector<unsigned char> out(static_cast<size_t>(stat.cbSize.QuadPart));
  ULONG read=0; requireHr(comStream->Read(out.data(),static_cast<ULONG>(out.size()),&read), "JPEG read failed");
  out.resize(read);
  return out;
}

void MjpegPreviewServer::streamClient(SOCKET client) {
  const HRESULT co = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  const std::string headers="HTTP/1.1 200 OK\r\nContent-Type: multipart/x-mixed-replace; boundary=viscoframe\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n";
  if(!sendAll(client,headers.data(),headers.size())){closesocket(client);return;}
  UINT64 last=0;
  while(running_) {
    auto frame=renderer_.latestFinal();
    if(frame && frame->timestampUs!=last) {
      try {
        auto jpeg=encodeJpeg(*frame);
        std::ostringstream part;
        part<<"--viscoframe\r\nContent-Type: image/jpeg\r\nContent-Length: "<<jpeg.size()<<"\r\nX-VisCo-Timestamp: "<<frame->timestampUs<<"\r\n\r\n";
        const auto s=part.str();
        if(!sendAll(client,s.data(),s.size()) || !sendAll(client,jpeg.data(),jpeg.size()) || !sendAll(client,"\r\n",2)) break;
        last=frame->timestampUs;
      } catch(...) { break; }
    } else Sleep(5);
  }
  closesocket(client);
  if (SUCCEEDED(co)) CoUninitialize();
}
