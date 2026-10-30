import type { Clock } from "./clock.js";

const MS_PER_SECOND = 1000;

interface Sample {
  readonly atMs: number;
  readonly count: number;
}

/** Counts events over a sliding time window and reports them as a total or per second. */
export class RateMeter {
  private readonly samples: Sample[] = [];
  private sum = 0;

  constructor(
    private readonly clock: Clock,
    private readonly windowMs: number,
  ) {}

  /** Records count events at the current time. */
  record(count = 1): void {
    this.samples.push({ atMs: this.clock.now(), count });
    this.sum += count;
    this.dropExpired();
  }

  /** Events recorded over the last window. */
  total(): number {
    this.dropExpired();
    return this.sum;
  }

  /** Events per second over the last window. */
  perSecond(): number {
    return (this.total() * MS_PER_SECOND) / this.windowMs;
  }

  private dropExpired(): void {
    const expiredUpTo = this.clock.now() - this.windowMs;
    while (this.samples.length > 0 && (this.samples[0]?.atMs ?? 0) <= expiredUpTo) {
      this.sum -= this.samples.shift()?.count ?? 0;
    }
  }
}
