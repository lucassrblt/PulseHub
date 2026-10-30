import type { Clock } from "./clock.js";

const MS_PER_SECOND = 1000;

/** Counts events over a sliding time window and reports them per second. */
export class RateMeter {
  private readonly timestamps: number[] = [];

  constructor(
    private readonly clock: Clock,
    private readonly windowMs: number,
  ) {}

  /** Records one event at the current time. */
  record(): void {
    this.timestamps.push(this.clock.now());
    this.dropExpired();
  }

  /** Events per second over the last window. */
  perSecond(): number {
    this.dropExpired();
    return (this.timestamps.length * MS_PER_SECOND) / this.windowMs;
  }

  private dropExpired(): void {
    const expiredUpTo = this.clock.now() - this.windowMs;
    while (this.timestamps.length > 0 && (this.timestamps[0] ?? 0) <= expiredUpTo) {
      this.timestamps.shift();
    }
  }
}
