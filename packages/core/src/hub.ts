import type { FeedEvent } from "./schemas.ts";
import type { Tracker } from "./tracker.ts";

/** What a stream sends: a change, which refreshes everything, or a draft saved, which refreshes only that draft. */
export type StreamMessage = { kind: "change"; events: readonly FeedEvent[] } | { kind: "draft"; key: string };

/** Wakes long polls and streams when something commits. In-process, as a Durable Object's would be. */
export class Hub {
  private waiters = new Set<() => void>();
  private readonly streams = new Set<(message: StreamMessage) => void>();

  constructor(tracker: Tracker) {
    tracker.subscribe((events) => {
      const waiting = this.waiters;
      this.waiters = new Set();
      for (const wake of waiting) wake();
      for (const stream of this.streams) stream({ kind: "change", events });
    });
    tracker.onDraft((key) => {
      for (const stream of this.streams) stream({ kind: "draft", key });
    });
  }

  /** Resolves at the next change, or after the timeout, whichever comes first. */
  nextChange(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const wake = () => {
        clearTimeout(timer);
        this.waiters.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, timeoutMs);
      this.waiters.add(wake);
    });
  }

  addStream(listener: (message: StreamMessage) => void): () => void {
    this.streams.add(listener);
    return () => {
      this.streams.delete(listener);
    };
  }
}
