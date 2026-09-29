#include "runtime-adapters.h"
#include <cstdlib>
#include <sstream>
#include <algorithm>

static std::string jsonEscapeRuntime(const std::string& s) {
  std::string out;
  for(char c:s){ if(c=='\\')out+="\\\\";
    else if(c=='"')out+="\\""; else if(static_cast<unsigned char>(c)>=32)out.push_back(c); }
  return out;
}
RuntimeAdapterRegistry::RuntimeAdapterRegistry() {
  statuses_.push_back(probe("NDI", {"Processing.NDI.Lib.x64.dll","Processing.NDI.Lib.dll","Processing.NDI.Lib.x86.dll"}, "VISCO_NDI_DLL"));
  statuses_.push_back(probe("OMT", {"libomt.dll","libvmx.dll"}, "VISCO_OMT_DLL"));
  statuses_.push_back(probe("ASIO", {"asio.dll","ASIO.dll"}, "VISCO_ASIO_DLL"));
}
RuntimeAdapterRegistry::~RuntimeAdapterRegistry() {
  for(auto& m:modules_) if(m.module) FreeLibrary(m.module);
}
RuntimeAdapterStatus RuntimeAdapterRegistry::probe(const char* name,const std::vector<std::string>& candidates,const char* envName) {
  std::vector<std::string> paths;
  if(const char* env=std::getenv(envName); env && *env) paths.push_back(env);
  paths.insert(paths.end(),candidates.begin(),candidates.end());
  for(const auto& path:paths) {
    HMODULE module=LoadLibraryA(path.c_str());
    if(module) {
      modules_.push_back({module});
      return {name,true,path,"Runtime library loaded; protocol-specific ABI adapter is ready for binding."};
    }
  }
  return {name,false,"","SDK/runtime library not found; source remains offline until installed/configured."};
}
std::string RuntimeAdapterRegistry::json() const {
  std::ostringstream body; body<<"{"adapters":[";
  for(size_t i=0;i<statuses_.size();++i){
    if(i)body<<",";
    const auto& s=statuses_[i];
    body<<"{"name":""<<jsonEscapeRuntime(s.name)<<"","available":"<<(s.available?"true":"false")
        <<","library":""<<jsonEscapeRuntime(s.library)<<"","message":""<<jsonEscapeRuntime(s.message)<<""}";
  }
  body<<"]}"; return body.str();
}
