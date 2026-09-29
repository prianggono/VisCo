export interface SourcePlaybackState {
  readonly sourceId: string;
  readonly playing: boolean;
  readonly positionMs: number;
  readonly durationMs: number | null;
  readonly speed: number;
  readonly loop: boolean;
}

export class SourcePlaybackEngine {
  private readonly states = new Map<string, SourcePlaybackState>();

  register(sourceId: string, durationMs: number | null = null): SourcePlaybackState {
    if (!sourceId.trim()) throw new Error("Source id is required.");
    if (this.states.has(sourceId)) throw new Error(`Source "${sourceId}" is already registered.`);
    const state = { sourceId, playing: false, positionMs: 0, durationMs, speed: 1, loop: false };
    this.states.set(sourceId, state);
    return state;
  }

  play(sourceId: string): SourcePlaybackState { return this.patch(sourceId, { playing: true }); }
  pause(sourceId: string): SourcePlaybackState { return this.patch(sourceId, { playing: false }); }
  seek(sourceId: string, positionMs: number): SourcePlaybackState {
    const state = this.require(sourceId);
    const max = state.durationMs ?? Number.POSITIVE_INFINITY;
    return this.patch(sourceId, { positionMs: Math.max(0, Math.min(max, positionMs)) });
  }

  setSpeed(sourceId: string, speed: number): SourcePlaybackState {
    if (!Number.isFinite(speed) || speed <= 0) throw new Error("Playback speed must be greater than zero.");
    return this.patch(sourceId, { speed });
  }

  setLoop(sourceId: string, loop: boolean): SourcePlaybackState { return this.patch(sourceId, { loop }); }

  get(sourceId: string): SourcePlaybackState { return this.require(sourceId); }

  private patch(sourceId: string, patch: Partial<SourcePlaybackState>): SourcePlaybackState {
    const next = { ...this.require(sourceId), ...patch };
    this.states.set(sourceId, next);
    return next;
  }

  private require(sourceId: string): SourcePlaybackState {
    const state = this.states.get(sourceId);
    if (!state) throw new Error(`Source "${sourceId}" is not registered.`);
    return state;
  }
}
