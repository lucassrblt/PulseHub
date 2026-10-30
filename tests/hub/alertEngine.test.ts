import { beforeEach, describe, expect, it } from "vitest";
import { AlertEngine } from "../../src/hub/alertEngine.js";
import { buildAlertRules } from "../../src/hub/alertRules.js";
import { loadConfig } from "../../src/hub/config.js";
import type { DeviceState } from "../../src/hub/deviceRegistry.js";
import { FakeClock } from "./fakeClock.js";

const CONFIG = loadConfig({});
const SECOND = 1000;

const NOMINAL: DeviceState = {
  deviceId: 3,
  temperatureC: 25,
  voltageMv: 24000,
  currentMa: 5000,
  lastSeenMs: 0,
  uptimeMs: 0,
  lastSeq: 1,
  lost: 0,
  duplicates: 0,
  late: 0,
  reboots: 0,
  resyncs: 0,
  outOfRange: 0,
};
const OVERHEATED: DeviceState = { ...NOMINAL, temperatureC: 75 };

describe("AlertEngine", () => {
  let clock: FakeClock;
  let engine: AlertEngine;

  beforeEach(() => {
    clock = new FakeClock();
    engine = new AlertEngine(clock, buildAlertRules(CONFIG), CONFIG);
  });

  function report(device: DeviceState): void {
    engine.evaluate({ ...device, lastSeenMs: clock.now() });
  }

  function overheatFor(ms: number): void {
    for (let elapsed = 0; elapsed < ms; elapsed += SECOND) {
      report(OVERHEATED);
      clock.advance(SECOND);
    }
  }

  it("has no alert at start", () => {
    expect(engine.active()).toEqual([]);
  });

  it("raises no alert before the condition held for 3 s", () => {
    report(OVERHEATED);
    clock.advance(CONFIG.alertDurationMs - 1);
    expect(engine.active()).toEqual([]);
  });

  it("raises the alert once the condition held for 3 s", () => {
    overheatFor(CONFIG.alertDurationMs);
    expect(engine.active()).toEqual([
      {
        deviceId: 3,
        ruleId: "temperature-critical",
        label: "Temperature at or above 70 °C",
        sinceMs: 0,
        durationMs: CONFIG.alertDurationMs,
      },
    ]);
  });

  it("clears the alert when the value comes back", () => {
    overheatFor(CONFIG.alertDurationMs);
    report(NOMINAL);
    expect(engine.active()).toEqual([]);
  });

  it("restarts the duration after an interruption", () => {
    overheatFor(2 * SECOND);
    report(NOMINAL);
    overheatFor(2 * SECOND);
    expect(engine.active()).toEqual([]);
  });

  it("tracks devices and rules independently", () => {
    for (let elapsed = 0; elapsed <= CONFIG.alertDurationMs; elapsed += SECOND) {
      report(OVERHEATED);
      report({ ...NOMINAL, deviceId: 1, voltageMv: 20000, currentMa: 11000 });
      clock.advance(SECOND);
    }
    expect(engine.active().map((alert) => [alert.deviceId, alert.ruleId])).toEqual([
      [1, "overcurrent"],
      [1, "voltage-out-of-range"],
      [3, "temperature-critical"],
    ]);
  });

  it("never raises an alert for a one-frame anomaly followed by silence", () => {
    report(OVERHEATED);
    for (let elapsed = 0; elapsed <= 2 * CONFIG.alertDurationMs; elapsed += SECOND) {
      expect(engine.active()).toEqual([]);
      clock.advance(SECOND);
    }
  });

  it("hides the alert of a device once it is offline", () => {
    overheatFor(CONFIG.alertDurationMs);
    report(OVERHEATED);
    expect(engine.active()).toHaveLength(1);
    clock.advance(CONFIG.offlineAfterMs + 1);
    expect(engine.active()).toEqual([]);
  });

  it("starts a fresh duration when an offline device comes back", () => {
    overheatFor(CONFIG.alertDurationMs);
    clock.advance(CONFIG.offlineAfterMs + 1);
    const backAtMs = clock.now();
    overheatFor(CONFIG.alertDurationMs);
    report(OVERHEATED);
    expect(engine.active()).toMatchObject([{ sinceMs: backAtMs, durationMs: CONFIG.alertDurationMs }]);
  });
});
