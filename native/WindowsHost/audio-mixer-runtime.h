#pragma once
#include "asio-audio-runtime.h"
#include <cstdint>
#include <mutex>
#include <string>
#include <vector>

namespace visco_audio {

struct AudioBusStats {
  uint64_t processedFrames = 0;
  uint64_t underrunFrames = 0;
  uint32_t sampleRate = 0;
  uint32_t channels = 0;
  float masterGain = 1.0f;
};

class AudioMixer {
public:
  explicit AudioMixer(visco_asio::AudioEngine& input, uint32_t sampleRate = 48000, uint32_t channels = 2);

  uint32_t process(float* outputInterleaved, uint32_t frames);
  void setMasterGain(float gain) noexcept;
  float masterGain() const noexcept;
  AudioBusStats stats() const noexcept;

private:
  visco_asio::AudioEngine& input_;
  uint32_t sampleRate_;
  uint32_t channels_;
  mutable std::mutex mutex_;
  float masterGain_ = 1.0f;
  uint64_t processedFrames_ = 0;
  uint64_t underrunFrames_ = 0;
  std::vector<float> inputBuffer_;
};

} // namespace visco_audio
