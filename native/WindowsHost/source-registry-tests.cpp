#include "source-registry.h"

#include <cassert>
#include <memory>

using visco_native::SourceRegistry;

static std::shared_ptr<NativeVideoFrame> frame(UINT64 timestamp) {
  auto value = std::make_shared<NativeVideoFrame>();
  value->width = 2;
  value->height = 2;
  value->timestampUs = timestamp;
  value->bgra.resize(16, static_cast<unsigned char>(timestamp & 0xff));
  return value;
}

int main() {
  SourceRegistry registry;
  const auto first = frame(1);
  const auto second = frame(2);
  const auto replacement = frame(3);

  // Binding an alias to a live producer immediately exposes its current frame.
  registry.publish("camera-A", first);
  assert(registry.bindAlias("ui-source", "camera-A"));
  assert(registry.latest("ui-source") == first);

  // Producer updates must refresh all aliases.
  registry.publish("camera-A", second);
  assert(registry.latest("camera-A") == second);
  assert(registry.latest("ui-source") == second);

  // Rebinding to an unresolved producer must not retain the old producer frame.
  assert(registry.bindAlias("ui-source", "camera-B"));
  assert(!registry.latest("ui-source"));
  registry.publish("camera-B", replacement);
  assert(registry.latest("ui-source") == replacement);

  // Removing a producer clears aliases and cached frames associated with it.
  registry.remove("camera-B");
  assert(!registry.latest("camera-B"));
  assert(!registry.latest("ui-source"));

  // Alias chains resolve to the producer, so updates/removal stay consistent.
  registry.publish("camera-A", first);
  assert(registry.bindAlias("alias-1", "camera-A"));
  assert(registry.bindAlias("alias-2", "alias-1"));
  assert(registry.latest("alias-2") == first);
  registry.publish("camera-A", second);
  assert(registry.latest("alias-1") == second);
  assert(registry.latest("alias-2") == second);
  registry.remove("camera-A");
  assert(!registry.latest("alias-1"));
  assert(!registry.latest("alias-2"));

  // Invalid/self aliases must not create state or a cycle.
  assert(!registry.bindAlias("", "camera-A"));
  assert(!registry.bindAlias("self", "self"));
  assert(registry.bindAlias("self", "alias-self"));
  assert(!registry.bindAlias("alias-self", "self"));
  assert(!registry.latest("self"));
  assert(!registry.latest("alias-self"));

  // Removing an alias itself must detach it from subsequent producer updates.
  registry.publish("camera-C", first);
  assert(registry.bindAlias("temporary", "camera-C"));
  registry.remove("temporary");
  registry.publish("camera-C", second);
  assert(!registry.latest("temporary"));
  assert(registry.latest("camera-C") == second);
  return 0;
}
