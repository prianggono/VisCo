#pragma once
#include "capture-runtime.h"
#include <string>
#include <memory>
#include <cstdint>

enum class NativeStreamProtocol { None, NDI, OMT };

class NativeOutputRuntime {
public:
  NativeOutputRuntime();
  ~NativeOutputRuntime();

  void startRecord(const std::string& path, UINT width, UINT height, UINT fps = 30);
  void startVirtual(const std::string& mappingName, UINT width, UINT height, UINT fps = 30);
  void startStream(NativeStreamProtocol protocol, const std::string& name, UINT width, UINT height, UINT fps = 30);

  void submit(const std::shared_ptr<const NativeVideoFrame>& frame, UINT64 frameNumber);
  void stop();
  bool recording() const { return recording_; }
  bool virtualOutput() const { return virtualOutput_; }
  bool streaming() const { return streaming_; }
  std::string error() const { return error_; }

private:
  class Impl;
  std::unique_ptr<Impl> impl_;
  bool recording_ = false;
  bool virtualOutput_ = false;
  bool streaming_ = false;
  std::string error_;

  void setError(const std::string& value) { error_ = value; }
};
