#include "asio-audio-runtime.h"
#include <algorithm>
#include <cstring>
#include <stdexcept>
#include <windows.h>
namespace visco_asio{
AsioAudioRuntime*AsioAudioRuntime::activeRuntime_=nullptr;
namespace{
std::string reg(HKEY root,const std::string&sub,const char*val){HKEY k=nullptr;if(RegOpenKeyExA(root,sub.c_str(),0,KEY_READ,&k)!=ERROR_SUCCESS)return{};char b[512]{};DWORD t=0,n=sizeof(b);LONG r=RegQueryValueExA(k,val,nullptr,&t,(BYTE*)b,&n);RegCloseKey(k);return r==ERROR_SUCCESS&&(t==REG_SZ||t==REG_EXPAND_SZ)?std::string(b):std::string();}
std::vector<AsioDriverInfo>scan(const char*p){std::vector<AsioDriverInfo>v;HKEY k=nullptr;if(RegOpenKeyExA(HKEY_LOCAL_MACHINE,p,0,KEY_READ,&k)!=ERROR_SUCCESS)return v;for(DWORD i=0;;++i){char n[256]{};DWORD z=sizeof(n);if(RegEnumKeyExA(k,i,n,&z,nullptr,nullptr,nullptr,nullptr)!=ERROR_SUCCESS)break;std::string s=std::string(p)+"\\"+n,c=reg(HKEY_LOCAL_MACHINE,s,"CLSID"),d=reg(HKEY_LOCAL_MACHINE,s,"Description");if(!c.empty())v.push_back({n,n,d.empty()?n:d,c});}RegCloseKey(k);return v;}
GUID guid(const std::string&s){GUID g{};std::wstring w(s.begin(),s.end());if(FAILED(CLSIDFromString(w.c_str(),&g)))throw std::runtime_error("Invalid ASIO CLSID.");return g;}
size_t bytes(long t){switch(t){case ASIOSTInt16LSB:return 2;case ASIOSTInt24LSB:return 3;case ASIOSTInt32LSB:case ASIOSTFloat32LSB:return 4;case ASIOSTFloat64LSB:return 8;default:return 0;}}
float cv(const uint8_t*p,long t){switch(t){case ASIOSTInt16LSB:{int16_t v;memcpy(&v,p,2);return v/32768.f;}case ASIOSTInt24LSB:{int32_t v=p[0]|p[1]<<8|p[2]<<16;if(v&0x800000)v|=0xff000000;return v/8388608.f;}case ASIOSTInt32LSB:{int32_t v;memcpy(&v,p,4);return v/2147483648.f;}case ASIOSTFloat64LSB:{double v;memcpy(&v,p,8);return(float)v;}default:{float v;memcpy(&v,p,4);return v;}}}
}
AudioEngine::AudioEngine(uint32_t sr,uint32_t ch,uint32_t cap):ring_((size_t)ch*cap),channels_(ch),capacityFrames_(cap),sampleRate_(sr){}
bool AudioEngine::pushInterleaved(const float*p,uint32_t n)noexcept{if(!p||!n)return true;auto r=readFrame_.load(std::memory_order_acquire),w=writeFrame_.load(std::memory_order_relaxed);if(n>capacityFrames_-(uint32_t)std::min<uint64_t>(w-r,capacityFrames_)){droppedFrames_+=n;overruns_++;return false;}for(uint32_t f=0;f<n;++f)memcpy(ring_.data()+((w+f)%capacityFrames_)*channels_,p+(size_t)f*channels_,sizeof(float)*channels_);writeFrame_.store(w+n,std::memory_order_release);callbackBlocks_++;callbackFrames_+=n;return true;}
uint32_t AudioEngine::pullInterleaved(float*p,uint32_t n)noexcept{if(!p||!n)return 0;auto r=readFrame_.load(std::memory_order_relaxed),w=writeFrame_.load(std::memory_order_acquire);uint32_t a=(uint32_t)std::min<uint64_t>(w-r,n);for(uint32_t f=0;f<a;++f)memcpy(p+(size_t)f*channels_,ring_.data()+((r+f)%capacityFrames_)*channels_,sizeof(float)*channels_);readFrame_.store(r+a,std::memory_order_release);return a;}
AudioEngineStats AudioEngine::stats()const noexcept{return{callbackBlocks_.load(),callbackFrames_.load(),droppedFrames_.load(),overruns_.load(),sampleRate_,channels_,0};}
uint32_t AudioEngine::availableFrames()const noexcept{return(uint32_t)std::min<uint64_t>(writeFrame_.load()-readFrame_.load(),capacityFrames_);}

AsioAudioRuntime::AsioAudioRuntime(AudioEngine&e):engine_(e){callbacks_.bufferSwitch=bufferSwitch;callbacks_.sampleRateDidChange=sampleRateChanged;callbacks_.asioMessage=asioMessage;callbacks_.bufferSwitchTimeInfo=bufferSwitchTimeInfo;}
AsioAudioRuntime::~AsioAudioRuntime(){stop();}
std::vector<AsioDriverInfo>AsioAudioRuntime::enumerateDrivers(){auto v=scan("SOFTWARE\\ASIO");if(v.empty())v=scan("SOFTWARE\\WOW6432Node\\ASIO");return v;}
bool AsioAudioRuntime::start(const std::string&sel,HWND hwnd,uint32_t want){
 stop();try{auto ds=enumerateDrivers();auto it=std::find_if(ds.begin(),ds.end(),[&](const AsioDriverInfo&d){return sel.empty()||sel==d.id||sel==d.name||sel==d.description;});if(it==ds.end())throw std::runtime_error("ASIO driver not found.");active_=*it;IASIO*d=nullptr;HRESULT h=CoCreateInstance(guid(active_.clsid),nullptr,CLSCTX_INPROC_SERVER,__uuidof(IASIO),(void**)&d);if(FAILED(h)||!d)throw std::runtime_error("ASIO COM driver creation failed.");driver_=d;if(!driver_->init(hwnd))throw std::runtime_error("ASIO driver initialization failed.");
long ni=0,no=0;if(driver_->getChannels(&ni,&no)!=0||ni<=0)throw std::runtime_error("ASIO driver has no input channels.");ASIOSampleRate rate=48000;driver_->getSampleRate(&rate);sampleRate_=(uint32_t)(rate+0.5);
long mn=0,mx=0,pref=0,gran=0;if(driver_->getBufferSize(&mn,&mx,&pref,&gran)!=0||pref<=0)throw std::runtime_error("ASIO buffer size query failed.");bufferFrames_=pref;inputChannels_=std::min<uint32_t>(want?want:2,(uint32_t)ni);buffers_.resize(inputChannels_);channelInfo_.resize(inputChannels_);scratch_.resize((size_t)bufferFrames_*inputChannels_);
for(uint32_t c=0;c<inputChannels_;++c){buffers_[c].isInput=1;buffers_[c].channelNum=c;channelInfo_[c].channel=c;channelInfo_[c].isInput=1;if(driver_->getChannelInfo(&channelInfo_[c])!=0||!bytes(channelInfo_[c].type))throw std::runtime_error("Unsupported ASIO input channel.");}
if(activeRuntime_&&activeRuntime_!=this)activeRuntime_->stop();activeRuntime_=this;if(driver_->createBuffers(buffers_.data(),inputChannels_,bufferFrames_,&callbacks_)!=0)throw std::runtime_error("ASIO buffer creation failed.");if(driver_->start()!=0)throw std::runtime_error("ASIO driver start failed.");running_=true;error_.clear();return true;
}catch(const std::exception&e){std::lock_guard<std::mutex>l(mutex_);error_=e.what();stop();return false;}}
void AsioAudioRuntime::stop(){running_=false;if(driver_){driver_->stop();driver_->disposeBuffers();driver_->Release();driver_=nullptr;}if(activeRuntime_==this)activeRuntime_=nullptr;buffers_.clear();channelInfo_.clear();scratch_.clear();sampleRate_=inputChannels_=bufferFrames_=0;}
std::string AsioAudioRuntime::error()const{std::lock_guard<std::mutex>l(mutex_);return error_;}
AsioDriverInfo AsioAudioRuntime::activeDriver()const{return active_;}
void __cdecl AsioAudioRuntime::bufferSwitch(long i,ASIOBool){if(activeRuntime_)activeRuntime_->onBufferSwitch(i);}
void __cdecl AsioAudioRuntime::sampleRateChanged(ASIOSampleRate r){if(activeRuntime_)activeRuntime_->onSampleRateChanged(r);}
long __cdecl AsioAudioRuntime::asioMessage(long s,long v,void*m,double*o){return activeRuntime_?activeRuntime_->onAsioMessage(s,v,m,o):0;}
ASIOTime*__cdecl AsioAudioRuntime::bufferSwitchTimeInfo(ASIOTime*t,long i,ASIOBool){if(activeRuntime_)activeRuntime_->onBufferSwitch(i);return t;}
void AsioAudioRuntime::onBufferSwitch(long i){if(!running_||i<0||i>1)return;for(uint32_t f=0;f<bufferFrames_;++f)for(uint32_t c=0;c<inputChannels_;++c){auto*p=(const uint8_t*)buffers_[c].buffers[i];scratch_[(size_t)f*inputChannels_+c]=cv(p+(size_t)f*bytes(channelInfo_[c].type),channelInfo_[c].type);}engine_.pushInterleaved(scratch_.data(),bufferFrames_);}
void AsioAudioRuntime::onSampleRateChanged(ASIOSampleRate r){if(r>0)sampleRate_=(uint32_t)(r+0.5);}
long AsioAudioRuntime::onAsioMessage(long s,long v,void*,double*){if(s==kAsioSelectorSupported)return v==kAsioSupportsTimeInfo?0:1;if(s==kAsioEngineVersion)return 2;if(s==kAsioResetRequest||s==kAsioResyncRequest)return 1;return 0;}
}