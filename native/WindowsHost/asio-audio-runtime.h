#pragma once
#include <windows.h>
#include <atomic>
#include <cstdint>
#include <mutex>
#include <string>
#include <vector>

namespace visco_asio {
using ASIOBool=long; using ASIOError=long; using ASIOSampleRate=double;
enum:long{ASE_SUCCESS=0,kAsioSelectorSupported=1,kAsioEngineVersion=2,kAsioResetRequest=3,kAsioBufferSizeChange=4,kAsioResyncRequest=5,kAsioLatenciesChanged=6,kAsioSupportsTimeInfo=7,kAsioSupportsTimeCode=8,kAsioOverload=15};
enum:long{ASIOSTInt16LSB=16,ASIOSTInt24LSB=17,ASIOSTInt32LSB=18,ASIOSTFloat32LSB=19,ASIOSTFloat64LSB=20};
struct ASIOBufferInfo{ASIOBool isInput;long channelNum;void* buffers[2];};
struct ASIOChannelInfo{long channel;ASIOBool isInput;ASIOBool isActive;long channelGroup;long type;char name[32];};
struct ASIOTime;
struct ASIOCallbacks{void(__cdecl*bufferSwitch)(long,ASIOBool);void(__cdecl*sampleRateDidChange)(ASIOSampleRate);long(__cdecl*asioMessage)(long,long,void*,double*);ASIOTime*(__cdecl*bufferSwitchTimeInfo)(ASIOTime*,long,ASIOBool);};
struct IASIO:public IUnknown{
virtual ASIOBool init(void*)=0;virtual void getDriverName(char*)=0;virtual long getDriverVersion()=0;virtual void getErrorMessage(char*)=0;virtual ASIOError start()=0;virtual ASIOError stop()=0;virtual ASIOError getChannels(long*,long*)=0;virtual ASIOError getLatencies(long*,long*)=0;virtual ASIOError getBufferSize(long*,long*,long*,long*)=0;virtual ASIOError canSampleRate(ASIOSampleRate)=0;virtual ASIOError getSampleRate(ASIOSampleRate*)=0;virtual ASIOError setSampleRate(ASIOSampleRate)=0;virtual ASIOError getClockSources(void*,long*)=0;virtual ASIOError setClockSource(long)=0;virtual ASIOError getSamplePosition(void*,void*)=0;virtual ASIOError getChannelInfo(ASIOChannelInfo*)=0;virtual ASIOError createBuffers(ASIOBufferInfo*,long,long,ASIOCallbacks*)=0;virtual ASIOError disposeBuffers()=0;virtual ASIOError controlPanel()=0;virtual ASIOError future(long,void*)=0;virtual ASIOError outputReady()=0;
};
struct AudioEngineStats{uint64_t callbackBlocks=0,callbackFrames=0,droppedFrames=0,overruns=0;uint32_t sampleRate=0,channels=0,bufferFrames=0;};
class AudioEngine{
public:AudioEngine(uint32_t sampleRate=48000,uint32_t channels=2,uint32_t capacityFrames=96000);
bool pushInterleaved(const float*,uint32_t)noexcept;uint32_t pullInterleaved(float*,uint32_t)noexcept;AudioEngineStats stats()const noexcept;uint32_t availableFrames()const noexcept;
private:std::vector<float>ring_;uint32_t channels_,capacityFrames_,sampleRate_;std::atomic<uint64_t>readFrame_{0},writeFrame_{0},callbackBlocks_{0},callbackFrames_{0},droppedFrames_{0},overruns_{0};
};
struct AsioDriverInfo{std::string id,name,description,clsid;};
class AsioAudioRuntime{
public:explicit AsioAudioRuntime(AudioEngine&);~AsioAudioRuntime();static std::vector<AsioDriverInfo>enumerateDrivers();
bool start(const std::string&,HWND,uint32_t requestedChannels=2);void stop();bool running()const noexcept{return running_;}std::string error()const;AsioDriverInfo activeDriver()const;uint32_t sampleRate()const noexcept{return sampleRate_;}uint32_t inputChannels()const noexcept{return inputChannels_;}uint32_t bufferFrames()const noexcept{return bufferFrames_;}
private:static void __cdecl bufferSwitch(long,ASIOBool);static void __cdecl sampleRateChanged(ASIOSampleRate);static long __cdecl asioMessage(long,long,void*,double*);static ASIOTime* __cdecl bufferSwitchTimeInfo(ASIOTime*,long,ASIOBool);
void onBufferSwitch(long);void onSampleRateChanged(ASIOSampleRate);long onAsioMessage(long,long,void*,double*);
AudioEngine&engine_;IASIO*driver_=nullptr;ASIOCallbacks callbacks_{};std::vector<ASIOBufferInfo>buffers_;std::vector<ASIOChannelInfo>channelInfo_;std::vector<float>scratch_;std::atomic<bool>running_{false};mutable std::mutex mutex_;std::string error_;AsioDriverInfo active_{};uint32_t sampleRate_=0,inputChannels_=0,bufferFrames_=0;static AsioAudioRuntime*activeRuntime_;
};
}