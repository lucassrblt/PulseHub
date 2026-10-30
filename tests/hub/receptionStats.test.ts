import { beforeEach, describe, expect, it } from "vitest";
import { ReceptionStats, type ReceptionSettings } from "../../src/hub/receptionStats.js";
import { FakeClock } from "./fakeClock.js";

const SETTINGS: ReceptionSettings = { rateWindowMs: 1000, healthWindowMs: 10_000, lossWarnPct: 1, lossCritPct: 5 };

const ACCEPTED = { kind: "accepted", lost: 0, rebooted: false, resynced: false } as const;

function receiveAccepted(stats: ReceptionStats, times: number, lost = 0): void {
  for (let index = 0; index < times; index++) {
    stats.recordReceived();
    stats.recordVerdict({ ...ACCEPTED, lost: index === 0 ? lost : 0 });
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
      resyncs: 0,
      unknownMetrics: 0,
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

  it("adds up the unknown metrics", () => {
    stats.recordUnknownMetrics(2);
    stats.recordUnknownMetrics(0);
    stats.recordUnknownMetrics(1);
    expect(stats.summary().unknownMetrics).toBe(3);
  });

  it("counts each verdict kind", () => {
    stats.recordVerdict({ ...ACCEPTED, lost: 2 });
    stats.recordVerdict({ ...ACCEPTED, resynced: true });
    stats.recordVerdict({ kind: "duplicate" });
    stats.recordVerdict({ kind: "late" });
    stats.recordVerdict({ kind: "late" });
    expect(stats.summary()).toMatchObject({ accepted: 2, lost: 2, resyncs: 1, duplicates: 1, late: 2 });
  });

  it("computes the loss rate as lost over accepted plus lost", () => {
    receiveAccepted(stats, 98, 2);
    expect(stats.summary().lossRatePct).toBe(2);
  });

  it("reports OK, WARN and CRIT health from the loss rate", () => {
    receiveAccepted(stats, 1000);
    expect(stats.summary().health).toBe("OK");
    stats.recordVerdict({ ...ACCEPTED, lost: 20 });
    expect(stats.summary().health).toBe("WARN");
    stats.recordVerdict({ ...ACCEPTED, lost: 60 });
    expect(stats.summary().health).toBe("CRIT");
  });

  it("reports health from the invalid rate", () => {
    receiveAccepted(stats, 9);
    stats.recordReceived();
    stats.recordInvalid("BAD_MAGIC");
    expect(stats.summary().invalidRatePct).toBe(10);
    expect(stats.summary().health).toBe("CRIT");
  });

  it("recovers OK health once a loss burst has left the health window", () => {
    receiveAccepted(stats, 100, 50);
    expect(stats.summary().health).toBe("CRIT");
    clock.advance(SETTINGS.healthWindowMs);
    receiveAccepted(stats, 10);
    expect(stats.summary()).toMatchObject({ lost: 50, accepted: 110, lossRatePct: 0, health: "OK" });
  });

  it("recovers OK health once an invalid burst has left the health window", () => {
    stats.recordReceived();
    stats.recordInvalid("BAD_CHECKSUM");
    expect(stats.summary().health).toBe("CRIT");
    clock.advance(SETTINGS.healthWindowMs);
    expect(stats.summary()).toMatchObject({ invalid: 1, invalidRatePct: 0, health: "OK" });
  });

  it("reports zero rates and OK health when the window holds no traffic", () => {
    receiveAccepted(stats, 10, 10);
    clock.advance(SETTINGS.healthWindowMs);
    expect(stats.summary()).toMatchObject({ lossRatePct: 0, invalidRatePct: 0, health: "OK" });
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
