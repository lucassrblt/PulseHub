import type { FaultCounter } from "./faults/stage.js";
import { MS_PER_SECOND, type Clock } from "../shared/time.js";

/** Formats the send rate and the injected fault counts. */
export class StatsReporter {
  private lastSent = 0;
  private lastMs: number;

  constructor(
    private readonly framesSent: () => number,
    private readonly faults: readonly FaultCounter[],
    private readonly clock: Clock,
  ) {
    this.lastMs = clock.now();
  }

  /** Line with the rate since the previous call. */
  rateLine(): string {
    const nowMs = this.clock.now();
    const sent = this.framesSent();
    const elapsedMs = nowMs - this.lastMs;
    const rate = elapsedMs > 0 ? Math.round(((sent - this.lastSent) * MS_PER_SECOND) / elapsedMs) : 0;
    this.lastSent = sent;
    this.lastMs = nowMs;
    return `sent ${rate} frames/s | ${this.faultSummary()}`;
  }

  /** Line with the totals since start. */
  totalsLine(): string {
    return `total ${this.framesSent()} frames | ${this.faultSummary()}`;
  }

  private faultSummary(): string {
    const counts = this.faults.map((fault) => `${fault.name}=${fault.injected}`);
    return `faults ${counts.join(" ")}`;
  }
}
