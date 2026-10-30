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
};
const OVERHEATED: DeviceState = { ...NOMINAL, temperatureC: 75 };

describe("AlertEngine", () => {
  let clock: FakeClock;
  let engine: AlertEngine;

  beforeEach(() => {
    clock = new FakeClock();
    engine = new AlertEngine(clock, buildAlertRules(CONFIG), CONFIG.alertDurationMs);
  });

  function overheatFor(ms: number): void {
    for (let elapsed = 0; elapsed < ms; elapsed += SECOND) {
      engine.evaluate(OVERHEATED);
      clock.advance(SECOND);
    }
  }

  it("has no alert at start", () => {
    expect(engine.active()).toEqual([]);
  });

  it("raises no alert before the condition held for 3 s", () => {
    engine.evaluate(OVERHEATED);
    clock.advance(CONFIG.alertDurationMs - 1);
    expect(engine.active()).toEqual([]);
  });

  it("raises the alert once the condition held for 3 s", () => {
    overheatFor(CONFIG.alertDurationMs);
    expect(engine.active()).toEqual([
      {
        deviceId: 3,
        ruleId: "temperature-critical",
        label: "Temperature above 70 °C",
        sinceMs: 0,
        durationMs: CONFIG.alertDurationMs,
      },
    ]);
  });

  it("clears the alert when the value comes back", () => {
    overheatFor(CONFIG.alertDurationMs);
    engine.evaluate(NOMINAL);
    expect(engine.active()).toEqual([]);
  });

  it("restarts the duration after an interruption", () => {
    overheatFor(2 * SECOND);
    engine.evaluate(NOMINAL);
    overheatFor(2 * SECOND);
    expect(engine.active()).toEqual([]);
  });

  it("tracks devices and rules independently", () => {
    engine.evaluate(OVERHEATED);
    engine.evaluate({ ...NOMINAL, deviceId: 1, voltageMv: 20000, currentMa: 11000 });
    clock.advance(CONFIG.alertDurationMs);
    expect(engine.active().map((alert) => [alert.deviceId, alert.ruleId])).toEqual([
      [1, "overcurrent"],
      [1, "voltage-out-of-range"],
      [3, "temperature-critical"],
    ]);
  });
});
