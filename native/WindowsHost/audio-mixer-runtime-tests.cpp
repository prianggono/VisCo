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

  mixer.setMasterGain(9.0f);
  REQUIRE(approximatelyEqual(mixer.masterGain(), 4.0f));
  mixer.setMasterGain(-1.0f);
  REQUIRE(approximatelyEqual(mixer.masterGain(), 0.0f));

  return 0;
}
