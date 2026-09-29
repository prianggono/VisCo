export interface FrameClockConfig {
  readonly fps?: number;
  readonly maxPending?: number;
}

export interface FrameClockStats {
  readonly fps: number;
  readonly intervalMs: number;
  readonly frameNumber: number;
  readonly droppedFrames: number;
  readonly pending: number;
}

/**
 * Lightweight real-time clock for VisCo's default 30 FPS runtime.
 * It never queues an unbounded backlog: if a consumer is still busy,
 * the next tick is dropped instead of increasing latency.
 */
export class FrameClock {
  private readonly fps: number;
  private readonly intervalMs: number;
  private readonly maxPending: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private frameNumber = 0;
  private droppedFrames = 0;
  private pending = 0;
  private nextDeadline = 0;

  constructor(config: FrameClockConfig = {}) {
    this.fps = config.fps ?? 30;
    this.intervalMs = 1000 / this.fps;
    this.maxPending = config.maxPending ?? 1;
    if (!Number.isFinite(this.fps) || this.fps <= 0 || this.fps > 120) {
      throw new Error("Frame clock FPS must be between 1 and 120.");
    }
    if (!Number.isInteger(this.maxPending) || this.maxPending < 1) {
      throw new Error("Frame clock maxPending must be a positive integer.");
    }
  }

  start(callback: (frameNumber: number) => void | Promise<void>): void {
    if (this.running) return;
    this.running = true;
    this.nextDeadline = performance.now();
    const tick = async () => {
      if (!this.running) return;
      const now = performance.now();
      if (this.pending < this.maxPending) {
        this.pending += 1;
        const frame = this.frameNumber++;
        try { await callback(frame); } finally { this.pending -= 1; }
      } else {
        this.frameNumber += 1;
        this.droppedFrames += 1;
      }
      this.nextDeadline += this.intervalMs;
      const delay = Math.max(0, this.nextDeadline - performance.now());
      this.timer = setTimeout(() => void tick(), delay);
      if (now - this.nextDeadline > this.intervalMs * 2) this.nextDeadline = performance.now();
    };
    this.timer = setTimeout(() => void tick(), 0);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = 0;
  }

  reset(): void {
    this.frameNumber = 0;
    this.droppedFrames = 0;
  }

  getStats(): FrameClockStats {
    return {
      fps: this.fps,
      intervalMs: this.intervalMs,
      frameNumber: this.frameNumber,
      droppedFrames: this.droppedFrames,
      pending: this.pending
    };
  }
}
