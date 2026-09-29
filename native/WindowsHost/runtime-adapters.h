#pragma once
#include <string>
#include <vector>
#include <windows.h>

struct RuntimeAdapterStatus {
  std::string name;
  bool available = false;
  std::string library;
  std::string message;
};

class RuntimeAdapterRegistry {
public:
  RuntimeAdapterRegistry();
  ~RuntimeAdapterRegistry();
  const std::vector<RuntimeAdapterStatus>& statuses() const { return statuses_; }
  std::string json() const;
private:
  struct Loaded { HMODULE module=nullptr; };
  std::vector<Loaded> modules_;
  std::vector<RuntimeAdapterStatus> statuses_;
  RuntimeAdapterStatus probe(const char* name, const std::vector<std::string>& candidates, const char* envName);
};
