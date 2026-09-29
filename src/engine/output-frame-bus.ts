import type { OutputFrame } from "./output-frame.js";

export interface OutputFrameSubscriber {
  readonly id: string;
  submit(frame: OutputFrame): Promise<void>;
}

export interface OutputFrameBusStats {
  readonly submitted: number;
  readonly failed: number;
  readonly subscribers: number;
}

/**
 * Single Program/Scene frame fan-out point.
 *
 * Every output receives the same immutable OutputFrame snapshot. Output
 * implementations must not mutate it or re-render the project independently.
 */
export class OutputFrameBus {
  private readonly subscribers = new Map<string, OutputFrameSubscriber>();
  private submitted = 0;
  private failed = 0;

  subscribe(subscriber: OutputFrameSubscriber): void {
    if (this.subscribers.has(subscriber.id)) {
      throw new Error(`Output frame subscriber "${subscriber.id}" is already registered.`);
    }
    this.subscribers.set(subscriber.id, subscriber);
  }

  unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  async publish(frame: OutputFrame): Promise<void> {
    const results = await Promise.allSettled(
      [...this.subscribers.values()].map((subscriber) => subscriber.submit(frame))
    );
    this.submitted += 1;
    for (const result of results) {
      if (result.status === "rejected") this.failed += 1;
    }
    if (results.some((result) => result.status === "rejected")) {
      throw new Error("One or more output frame subscribers failed.");
    }
  }

  getStats(): OutputFrameBusStats {
    return {
      submitted: this.submitted,
      failed: this.failed,
      subscribers: this.subscribers.size
    };
  }
}
