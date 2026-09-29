#include "audio-mixer-runtime.h"
#include <algorithm>
#include <cmath>

namespace visco_audio {

AudioMixer::AudioMixer(visco_asio::AudioEngine& input, uint32_t sampleRate, uint32_t channels)
  : input_(input), sampleRate_(sampleRate), channels_(channels) {}

uint32_t AudioMixer::process(float* outputInterleaved, uint32_t frames) {
  if (!outputInterleaved || frames == 0 || channels_ == 0) return 0;
  inputBuffer_.resize(static_cast<size_t>(frames) * channels_);
  const uint32_t available = input_.pullInterleaved(inputBuffer_.data(), frames);
  const float gain = masterGain();

  const size_t availableSamples = static_cast<size_t>(available) * channels_;
  for (size_t i = 0; i < availableSamples; ++i) {
    const float sample = inputBuffer_[i] * gain;
    outputInterleaved[i] = std::clamp(sample, -1.0f, 1.0f);
  }
  const size_t missingSamples = (static_cast<size_t>(frames) - available) * channels_;
  std::fill(outputInterleaved + availableSamples,
            outputInterleaved + availableSamples + missingSamples, 0.0f);

  {
    std::lock_guard<std::mutex> lock(mutex_);
    processedFrames_ += available;
    underrunFrames_ += frames - available;
  }
  return available;
}

void AudioMixer::setMasterGain(float gain) noexcept {
  if (!std::isfinite(gain)) gain = 1.0f;
  std::lock_guard<std::mutex> lock(mutex_);
  masterGain_ = std::clamp(gain, 0.0f, 4.0f);
}

float AudioMixer::masterGain() const noexcept {
  std::lock_guard<std::mutex> lock(mutex_);
  return masterGain_;
}

AudioBusStats AudioMixer::stats() const noexcept {
  std::lock_guard<std::mutex> lock(mutex_);
  return {
    processedFrames_,
    underrunFrames_,
    sampleRate_,
    channels_,
    masterGain_
  };
}

} // namespace visco_audio
