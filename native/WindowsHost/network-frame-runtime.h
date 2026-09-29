#pragma once
#include "capture-runtime.h"
#include <string>
#include <vector>
#include <memory>
#include <thread>
#include <atomic>
#include <mutex>

enum class NetworkProtocol { None, NDI, OMT };

struct NetworkSourceInfo {
  std::string id;
  std::string name;
  NetworkProtocol protocol = NetworkProtocol::None;
  std::string address;
};

class NetworkFrameRuntime {
public:
  NetworkFrameRuntime();
  ~NetworkFrameRuntime();

  bool available(NetworkProtocol protocol) const;
  std::vector<NetworkSourceInfo> discover(NetworkProtocol protocol);
  void start(NetworkProtocol protocol, const std::string& source);
  void stop();
  bool running() const { return running_; }
  NetworkProtocol protocol() const { return protocol_; }
  std::shared_ptr<const NativeVideoFrame> latest() const;
  std::string error() const;

private:
  class Impl;
  std::unique_ptr<Impl> impl_;
  std::atomic<bool> running_{false};
  std::thread thread_;
  mutable std::mutex mutex_;
  std::shared_ptr<NativeVideoFrame> latest_;
  std::string error_;
  NetworkProtocol protocol_ = NetworkProtocol::None;
  std::string source_;

  void loop();
  void setError(const std::string& error);
  void publish(std::shared_ptr<NativeVideoFrame> frame);
};
