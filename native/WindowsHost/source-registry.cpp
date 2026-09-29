#include "source-registry.h"

namespace visco_native {

void SourceRegistry::publish(const std::string& sourceId, const std::shared_ptr<const NativeVideoFrame>& frame) {
  if (sourceId.empty() || !frame) return;
  std::lock_guard<std::mutex> lock(mutex_);
  frames_[sourceId] = frame;
  for (const auto& [alias, nativeId] : aliases_) if (nativeId == sourceId) frames_[alias] = frame;
}

std::shared_ptr<const NativeVideoFrame> SourceRegistry::latest(const std::string& sourceId) const {
  std::lock_guard<std::mutex> lock(mutex_);
  const auto it = frames_.find(sourceId);
  return it == frames_.end() ? nullptr : it->second;
}

void SourceRegistry::remove(const std::string& sourceId) {
  std::lock_guard<std::mutex> lock(mutex_);
  frames_.erase(sourceId);
}

void SourceRegistry::bindAlias(const std::string& sourceId, const std::string& nativeSourceId) {
  if (sourceId.empty() || nativeSourceId.empty()) return;
  std::lock_guard<std::mutex> lock(mutex_);
  aliases_[sourceId] = nativeSourceId;
  const auto it = frames_.find(nativeSourceId);
  if (it != frames_.end()) frames_[sourceId] = it->second;
}

} // namespace visco_native
