#include "source-registry.h"

#include <cstdio>
#include <memory>

using visco_native::SourceRegistry;

#define REQUIRE(condition) do { if (!(condition)) { \
  std::fprintf(stderr, "Requirement failed at line %d: %s\\n", __LINE__, #condition); \
  return __LINE__; \
} } while (false)

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
  REQUIRE(registry.bindAlias("ui-source", "camera-A"));
  REQUIRE(registry.latest("ui-source") == first);

  // Producer updates must refresh all aliases.
  registry.publish("camera-A", second);
  REQUIRE(registry.latest("camera-A") == second);
  REQUIRE(registry.latest("ui-source") == second);

  // Rebinding to an unresolved producer must not retain the old producer frame.
  REQUIRE(registry.bindAlias("ui-source", "camera-B"));
  REQUIRE(!registry.latest("ui-source"));
  registry.publish("camera-B", replacement);
  REQUIRE(registry.latest("ui-source") == replacement);

  // Removing a producer clears aliases and cached frames associated with it.
  registry.remove("camera-B");
  REQUIRE(!registry.latest("camera-B"));
  REQUIRE(!registry.latest("ui-source"));

  // Alias chains resolve to the producer, so updates/removal stay consistent.
  registry.publish("camera-A", first);
  REQUIRE(registry.bindAlias("alias-1", "camera-A"));
  REQUIRE(registry.bindAlias("alias-2", "alias-1"));
  REQUIRE(registry.latest("alias-2") == first);
  registry.publish("camera-A", second);
  REQUIRE(registry.latest("alias-1") == second);
  REQUIRE(registry.latest("alias-2") == second);
  registry.remove("camera-A");
  REQUIRE(!registry.latest("alias-1"));
  REQUIRE(!registry.latest("alias-2"));

  // Invalid/self aliases must not create state or a cycle.
  REQUIRE(!registry.bindAlias("", "camera-A"));
  REQUIRE(!registry.bindAlias("self", "self"));
  REQUIRE(registry.bindAlias("self", "alias-self"));
  REQUIRE(!registry.bindAlias("alias-self", "self"));
  REQUIRE(!registry.latest("self"));
  REQUIRE(!registry.latest("alias-self"));

  // Removing an alias itself must detach it from subsequent producer updates.
  registry.publish("camera-C", first);
  REQUIRE(registry.bindAlias("temporary", "camera-C"));
  registry.remove("temporary");
  registry.publish("camera-C", second);
  REQUIRE(!registry.latest("temporary"));
  REQUIRE(registry.latest("camera-C") == second);
  return 0;
}
