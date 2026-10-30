import { describe, expect, it } from "vitest";
import type { FleetSnapshot } from "../../src/hub/fleetSummary.js";
import { formatStatusLine } from "../../src/hub/statusLine.js";

const SNAPSHOT: FleetSnapshot = {
  generatedAt: 0,
  hubUptimeMs: 0,
  reception: {
    received: 120,
    valid: 115,
    invalid: 5,
    invalidByReason: { BAD_CHECKSUM: 5 },
    accepted: 110,
    duplicates: 3,
    late: 2,
    lost: 4,
    resyncs: 0,
    unknownMetrics: 0,
    framesPerSecond: 12.345,
    lossRatePct: 3.5087,
    invalidRatePct: 4.1667,
    healthWindowMs: 10_000,
    health: "WARN",
  },
  thresholds: { temperatureWarnC: 60, temperatureCritC: 70, voltageMinMv: 22_000, voltageMaxMv: 26_000, currentMaxMa: 10_000 },
  fleet: { total: 5, online: 4, ok: 3, warn: 1, crit: 0, offline: 1, outOfRangeFrames: 0, reboots: 0 },
  hottest: [],
  devices: [],
  alerts: [],
};

describe("formatStatusLine", () => {
  it("summarizes the snapshot on one line", () => {
    expect(formatStatusLine(SNAPSHOT)).toBe(
      "fps=12.3 accepted=110 invalid=5 duplicates=3 late=2 lost=4 loss=3.5% health=WARN online=4/5 alerts=0",
    );
  });
});
