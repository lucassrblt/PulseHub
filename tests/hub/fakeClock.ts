import type { Clock } from "../../src/shared/time.js";

/** Manually driven clock for time-based tests. */
export class FakeClock implements Clock {
  constructor(private current = 0) {}

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}
