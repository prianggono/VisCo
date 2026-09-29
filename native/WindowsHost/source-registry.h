#pragma once
#include "capture-runtime.h"
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

namespace visco_native {

class SourceRegistry {
public:
  void publish(const std::string& sourceId, const std::shared_ptr<const NativeVideoFrame>& frame);
  std::shared_ptr<const NativeVideoFrame> latest(const std::string& sourceId) const;
  void remove(const std::string& sourceId);
  void bindAlias(const std::string& sourceId, const std::string& nativeSourceId);
private:
  mutable std::mutex mutex_;
  std::unordered_map<std::string, std::shared_ptr<const NativeVideoFrame>> frames_;
};

} // namespace visco_native
