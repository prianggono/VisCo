#include "source-registry.h"
#include <unordered_set>

namespace visco_native {

void SourceRegistry::publish(const std::string& sourceId, const std::shared_ptr<const NativeVideoFrame>& frame) {
  if (sourceId.empty() || !frame) return;
  std::lock_guard<std::mutex> lock(mutex_);
  frames_[sourceId] = frame;
  for (const auto& [alias, nativeId] : aliases_) {
    if (nativeId == sourceId) frames_[alias] = frame;
  }
}

std::shared_ptr<const NativeVideoFrame> SourceRegistry::latest(const std::string& sourceId) const {
  std::lock_guard<std::mutex> lock(mutex_);
  const auto it = frames_.find(sourceId);
  return it == frames_.end() ? nullptr : it->second;
}

void SourceRegistry::remove(const std::string& sourceId) {
  if (sourceId.empty()) return;
  std::lock_guard<std::mutex> lock(mutex_);
  frames_.erase(sourceId);
  aliases_.erase(sourceId);

  // Aliases cache the latest frame for fast reads. Remove those cached frames
  // together with the source so a stopped/replaced producer cannot leak stale
  // video into a layer.
  for (auto it = aliases_.begin(); it != aliases_.end();) {
    if (it->second == sourceId) {
      frames_.erase(it->first);
      it = aliases_.erase(it);
    } else {
      ++it;
    }
  }
}

void SourceRegistry::bindAlias(const std::string& sourceId, const std::string& nativeSourceId) {
  if (sourceId.empty() || nativeSourceId.empty() || sourceId == nativeSourceId) return;
  std::lock_guard<std::mutex> lock(mutex_);

  // Resolve to a producer ID rather than allowing alias chains. This keeps
  // publish/remove deterministic and rejects cycles before changing state.
  std::string resolvedId = nativeSourceId;
  std::unordered_set<std::string> visited;
  while (true) {
    if (resolvedId == sourceId || !visited.insert(resolvedId).second) return;
    const auto it = aliases_.find(resolvedId);
    if (it == aliases_.end()) break;
    resolvedId = it->second;
  }

  aliases_[sourceId] = resolvedId;
  const auto it = frames_.find(resolvedId);
  if (it != frames_.end()) {
    frames_[sourceId] = it->second;
  } else {
    // Do not leave the previous producer's cached frame after a rebind.
    frames_.erase(sourceId);
  }
}

} // namespace visco_native
