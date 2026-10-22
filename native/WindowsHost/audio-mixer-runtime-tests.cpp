#include "audio-mixer-runtime.h"

#include <cmath>
#include <cstdio>
#include <vector>

#define REQUIRE(condition) do { if (!(condition)) { \
  std::fprintf(stderr, "Requirement failed at line %d: %s\n", __LINE__, #condition); \
  return __LINE__; \
} } while (false)

static bool approximatelyEqual(float actual, float expected) {
  return std::fabs(actual - expected) < 0.0001f;
}

int main() {
  visco_asio::AudioEngine engine(48000, 2, 16);
  visco_audio::AudioMixer mixer(engine, 48000, 2);

  const float input[] = {0.25f, -0.25f, 0.5f, -0.5f};
  REQUIRE(engine.pushInterleaved(input, 2));

  mixer.setMasterGain(2.0f);
  float output[8];
  for (float& sample : output) sample = 99.0f;

  const uint32_t available = mixer.process(output, 4);
  REQUIRE(available == 2);
  REQUIRE(approximatelyEqual(output[0], 0.5f));
  REQUIRE(approximatelyEqual(output[1], -0.5f));
  REQUIRE(approximatelyEqual(output[2], 1.0f));
  REQUIRE(approximatelyEqual(output[3], -1.0f));
  REQUIRE(approximatelyEqual(output[4], 0.0f));
  REQUIRE(approximatelyEqual(output[5], 0.0f));
  REQUIRE(approximatelyEqual(output[6], 0.0f));
  REQUIRE(approximatelyEqual(output[7], 0.0f));

  const auto stats = mixer.stats();
  REQUIRE(stats.processedFrames == 2);
  REQUIRE(stats.underrunFrames == 2);
  REQUIRE(stats.sampleRate == 48000);
  REQUIRE(stats.channels == 2);
  REQUIRE(approximatelyEqual(stats.masterGain, 2.0f));

  engine.setSampleRate(44100);
  mixer.setSampleRate(44100);
  REQUIRE(engine.stats().sampleRate == 44100);
  REQUIRE(mixer.stats().sampleRate == 44100);

  mixer.setMasterGain(9.0f);
  REQUIRE(approximatelyEqual(mixer.masterGain(), 4.0f));
  mixer.setMasterGain(-1.0f);
  REQUIRE(approximatelyEqual(mixer.masterGain(), 0.0f));

  const float malformed[] = {NAN, INFINITY};
  REQUIRE(engine.pushInterleaved(malformed, 1));
  float sanitized[2] = {7.0f, 7.0f};
  REQUIRE(mixer.process(sanitized, 1) == 1);
  REQUIRE(approximatelyEqual(sanitized[0], 0.0f));
  REQUIRE(approximatelyEqual(sanitized[1], 0.0f));

  visco_asio::AudioEngine smallEngine(48000, 2, 2);
  const float firstBlock[] = {0.1f, -0.1f, 0.2f, -0.2f};
  const float overflowBlock[] = {0.3f, -0.3f};
  REQUIRE(smallEngine.pushInterleaved(firstBlock, 2));
  REQUIRE(!smallEngine.pushInterleaved(overflowBlock, 1));
  const auto overflowStats = smallEngine.stats();
  REQUIRE(overflowStats.overruns == 1);
  REQUIRE(overflowStats.droppedFrames == 1);
  float retained[4] = {};
  REQUIRE(smallEngine.pullInterleaved(retained, 2) == 2);
  REQUIRE(approximatelyEqual(retained[0], 0.1f));
  REQUIRE(approximatelyEqual(retained[1], -0.1f));
  REQUIRE(approximatelyEqual(retained[2], 0.2f));
  REQUIRE(approximatelyEqual(retained[3], -0.2f));

  return 0;
}
