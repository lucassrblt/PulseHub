import { describe, expect, it } from "vitest";
import { StatsReporter } from "../../src/simulator/stats.js";
import { FakeClock } from "./fakes.js";

describe("StatsReporter", () => {
  it("reports the rate since the previous line and the fault counts", () => {
    const clock = new FakeClock(0);
    let sent = 0;
    const reporter = new StatsReporter(() => sent, [{ name: "dup", injected: 3 }], clock);
    sent = 500;
    clock.nowMs = 500;
    expect(reporter.rateLine()).toBe("sent 1000 frames/s | faults dup=3");
    sent = 1500;
    clock.nowMs = 1500;
    expect(reporter.rateLine()).toBe("sent 1000 frames/s | faults dup=3");
    expect(reporter.totalsLine()).toBe("total 1500 frames | faults dup=3");
  });
});
