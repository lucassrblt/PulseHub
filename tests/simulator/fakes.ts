import type { Cancel, Clock, Timer } from "../../src/shared/time.js";
import type { DatagramSender, Random } from "../../src/simulator/ports.js";

/** Deterministic pseudo-random generator (mulberry32) for reproducible tests. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random source that always returns the same value. */
export function constantRandom(value: number): Random {
  return () => value;
}

/** Clock moved by hand. */
export class FakeClock implements Clock {
  constructor(public nowMs = 0) {}

  now(): number {
    return this.nowMs;
  }
}

/** Timer whose tasks run only when fired by the test. */
export class FakeTimer implements Timer {
  private readonly tasks = new Set<() => void>();

  every(_intervalMs: number, task: () => void): Cancel {
    this.tasks.add(task);
    return () => this.tasks.delete(task);
  }

  fire(): void {
    this.tasks.forEach((task) => task());
  }
}

/** Sender that records every datagram. */
export class RecordingSender implements DatagramSender {
  readonly sent: Uint8Array[] = [];
  closed = false;

  send(bytes: Uint8Array): void {
    this.sent.push(bytes);
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}
