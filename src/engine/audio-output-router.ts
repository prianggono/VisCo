import type { AudioEngine, AudioDeckState } from "../domain/audio.js";
import type { OutputEngine, OutputState } from "./output-engine.js";

export interface AudioOutputState {
  readonly sourceDecks: readonly AudioDeckState[];
  readonly outputs: readonly string[];
}

/**
 * Connects the Master Audio mix to the enabled Media Output features.
 * Visual routing remains owned by OutputEngine; this bridge only describes
 * which active Audio Decks feed the shared media pipeline.
 */
export class AudioOutputRouter {
  constructor(
    private readonly audioEngine: AudioEngine,
    private readonly outputEngine: OutputEngine
  ) {}

  sync(): AudioOutputState {
    const sourceDecks = this.audioEngine.getActiveLayers();
    const outputs = this.outputEngine
      .getActiveStates()
      .filter((state) => state.target.kind === "media" && state.target.media)
      .filter((state) => state.target.media?.streaming || state.target.media?.recording || state.target.media?.virtual)
      .map((state) => state.target.id);

    return { sourceDecks, outputs };
  }

  getMediaOutputs(): readonly OutputState[] {
    return this.outputEngine
      .getActiveStates()
      .filter((state) => state.target.kind === "media" && state.target.media)
      .filter((state) => state.target.media?.streaming || state.target.media?.recording || state.target.media?.virtual);
  }
}
