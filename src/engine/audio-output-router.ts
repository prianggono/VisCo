import type { AudioEngine, AudioRoutingEngine, AudioDestination, MasterAudioMix } from "../domain/audio.js";
import type { OutputEngine, OutputState } from "./output-engine.js";

export interface AudioOutputState {
  readonly mix: MasterAudioMix;
  readonly outputs: readonly string[];
  readonly vbDestinations: readonly AudioDestination[];
}

/**
 * Describes the canonical audio path:
 * Audio In -> VisCo VB -> Record / Stream / Zoom.
 * Monitoring is diagnostic and is not part of this signal path.
 */
export class AudioOutputRouter {
  constructor(
    private readonly audioEngine: AudioEngine,
    private readonly outputEngine: OutputEngine,
    private readonly routingEngine?: AudioRoutingEngine
  ) {}

  sync(): AudioOutputState {
    const mix = this.audioEngine.getMasterMix();
    const outputs = this.outputEngine
      .getActiveStates()
      .filter((state) => state.target.kind === "media" && state.target.media)
      .filter((state) => state.target.media?.streaming || state.target.media?.recording || state.target.media?.virtual)
      .map((state) => state.target.id);

    const vbDestinations = this.routingEngine?.getDestinationsFromVb() ?? [];

    return { mix, outputs, vbDestinations };
  }

  getMediaOutputs(): readonly OutputState[] {
    return this.outputEngine
      .getActiveStates()
      .filter((state) => state.target.kind === "media" && state.target.media)
      .filter((state) => state.target.media?.streaming || state.target.media?.recording || state.target.media?.virtual);
  }
}
