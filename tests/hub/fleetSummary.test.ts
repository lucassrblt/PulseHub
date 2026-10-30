import { beforeEach, describe, expect, it } from "vitest";
import { AlertEngine } from "../../src/hub/alertEngine.js";
import { buildAlertRules } from "../../src/hub/alertRules.js";
import { loadConfig } from "../../src/hub/config.js";
import { DeviceRegistry } from "../../src/hub/deviceRegistry.js";
import { DeviceStatusEvaluator } from "../../src/hub/deviceStatus.js";
import { FleetSummary } from "../../src/hub/fleetSummary.js";
import { ReceptionStats } from "../../src/hub/receptionStats.js";
import { buildStatusRules } from "../../src/hub/statusRules.js";
import { buildOutOfRangePredicate } from "../../src/hub/thresholds.js";
import { FakeClock } from "./fakeClock.js";
import { NOMINAL, telemetry } from "./frames.js";

const CONFIG = loadConfig({});
const STARTED_AT = 50_000;
const ACCEPTED = { kind: "accepted", lost: 0, rebooted: false, resynced: false } as const;

describe("FleetSummary", () => {
  let clock: FakeClock;
  let registry: DeviceRegistry;
  let summary: FleetSummary;

  beforeEach(() => {
    clock = new FakeClock(STARTED_AT);
    registry = new DeviceRegistry(clock, buildOutOfRangePredicate(CONFIG));
    summary = new FleetSummary({
      clock,
      startedAtMs: STARTED_AT,
      reception: new ReceptionStats(clock, CONFIG),
      devices: registry,
      statuses: new DeviceStatusEvaluator(clock, CONFIG.offlineAfterMs, buildStatusRules(CONFIG)),
      alerts: new AlertEngine(clock, buildAlertRules(CONFIG), CONFIG),
    });
  });

  function addDevice(deviceId: number, hundredthsC: number): void {
    registry.record(telemetry(deviceId, 1, { ...NOMINAL, hundredthsC }), ACCEPTED);
  }

  it("shows zero or empty values everywhere on a fresh hub", () => {
    expect(summary.snapshot()).toEqual({
      generatedAt: STARTED_AT,
      hubUptimeMs: 0,
      reception: {
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
      },
      fleet: { total: 0, online: 0, ok: 0, warn: 0, crit: 0, offline: 0, outOfRangeFrames: 0, reboots: 0 },
      hottest: [],
      devices: [],
      alerts: [],
    });
  });

  it("is plain serializable data", () => {
    addDevice(1, 3000);
    const snapshot = summary.snapshot();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("lists devices sorted by id with their status", () => {
    addDevice(9, 6500);
    addDevice(2, 2500);
    addDevice(5, 7200);
    expect(summary.snapshot().devices.map((device) => [device.deviceId, device.status])).toEqual([
      [2, "OK"],
      [5, "CRIT"],
      [9, "WARN"],
    ]);
  });

  it("counts devices per status, including offline ones", () => {
    addDevice(1, 2500);
    clock.advance(CONFIG.offlineAfterMs + 1);
    addDevice(2, 6500);
    addDevice(3, 7200);
    expect(summary.snapshot().fleet).toMatchObject({ total: 3, online: 2, ok: 0, warn: 1, crit: 1, offline: 1 });
  });

  it("sums out-of-range frames and reboots over the fleet", () => {
    addDevice(1, 7200);
    addDevice(1, 7300);
    addDevice(2, 2500);
    registry.record(telemetry(2, 1, NOMINAL), { ...ACCEPTED, rebooted: true });
    addDevice(3, 6500);
    expect(summary.snapshot().fleet).toMatchObject({ outOfRangeFrames: 3, reboots: 1 });
  });

  it("ranks the five hottest online devices", () => {
    [2000, 4500, 3000, 7000, 1000, 6500, 5000].forEach((hundredthsC, index) => addDevice(index + 1, hundredthsC));
    expect(summary.snapshot().hottest.map((device) => device.temperatureC)).toEqual([70, 65, 50, 45, 30]);
  });

  it("reports the hub uptime", () => {
    clock.advance(1234);
    expect(summary.snapshot().hubUptimeMs).toBe(1234);
  });
});
