import { beforeEach, describe, expect, it } from "vitest";
import { ReceptionStats, type ReceptionSettings } from "../../src/hub/receptionStats.js";
import { FakeClock } from "./fakeClock.js";

const SETTINGS: ReceptionSettings = { rateWindowMs: 1000, lossWarnPct: 1, lossCritPct: 5 };

function receiveAccepted(stats: ReceptionStats, times: number, lost = 0): void {
  for (let index = 0; index < times; index++) {
    stats.recordReceived();
    stats.recordVerdict({ kind: "accepted", lost: index === 0 ? lost : 0 });
  }
}

describe("ReceptionStats", () => {
  let clock: FakeClock;
  let stats: ReceptionStats;

  beforeEach(() => {
    clock = new FakeClock();
    stats = new ReceptionStats(clock, SETTINGS);
  });

  it("starts with every value at zero", () => {
    expect(stats.summary()).toEqual({
      received: 0,
      valid: 0,
      invalid: 0,
      invalidByReason: {},
      accepted: 0,
      duplicates: 0,
      late: 0,
      lost: 0,
      framesPerSecond: 0,
      lossRatePct: 0,
      invalidRatePct: 0,
      health: "OK",
    });
  });

  it("counts invalid frames by reason", () => {
    stats.recordReceived();
    stats.recordInvalid("BAD_CHECKSUM");
    stats.recordReceived();
    stats.recordInvalid("BAD_CHECKSUM");
    stats.recordReceived();
    stats.recordInvalid("TOO_SHORT");
    stats.recordReceived();
    const summary = stats.summary();
    expect(summary.received).toBe(4);
    expect(summary.valid).toBe(1);
    expect(summary.invalid).toBe(3);
    expect(summary.invalidByReason).toEqual({ BAD_CHECKSUM: 2, TOO_SHORT: 1 });
  });

  it("counts each verdict kind", () => {
    stats.recordVerdict({ kind: "accepted", lost: 2 });
    stats.recordVerdict({ kind: "duplicate" });
    stats.recordVerdict({ kind: "late" });
    stats.recordVerdict({ kind: "late" });
    expect(stats.summary()).toMatchObject({ accepted: 1, lost: 2, duplicates: 1, late: 2 });
  });

  it("computes the loss rate as lost over accepted plus lost", () => {
    receiveAccepted(stats, 98, 2);
    expect(stats.summary().lossRatePct).toBe(2);
  });

  it("reports OK, WARN and CRIT health from the loss rate", () => {
    receiveAccepted(stats, 1000);
    expect(stats.summary().health).toBe("OK");
    stats.recordVerdict({ kind: "accepted", lost: 20 });
    expect(stats.summary().health).toBe("WARN");
    stats.recordVerdict({ kind: "accepted", lost: 60 });
    expect(stats.summary().health).toBe("CRIT");
  });

  it("reports health from the invalid rate", () => {
    receiveAccepted(stats, 9);
    stats.recordReceived();
    stats.recordInvalid("BAD_MAGIC");
    expect(stats.summary().invalidRatePct).toBe(10);
    expect(stats.summary().health).toBe("CRIT");
  });

  it("measures frames per second over the sliding window", () => {
    receiveAccepted(stats, 5);
    clock.advance(500);
    receiveAccepted(stats, 5);
    expect(stats.summary().framesPerSecond).toBe(10);
    clock.advance(600);
    expect(stats.summary().framesPerSecond).toBe(5);
    clock.advance(1000);
    expect(stats.summary().framesPerSecond).toBe(0);
  });
});
