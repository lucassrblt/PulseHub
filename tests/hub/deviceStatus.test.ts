import { beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/hub/config.js";
import type { DeviceState } from "../../src/hub/deviceRegistry.js";
import { DeviceStatusEvaluator } from "../../src/hub/deviceStatus.js";
import { worstLevel } from "../../src/hub/health.js";
import { buildStatusRules } from "../../src/hub/statusRules.js";
import { FakeClock } from "./fakeClock.js";

const CONFIG = loadConfig({});
const SEEN_AT = 10_000;

const HEALTHY: DeviceState = {
  deviceId: 1,
  temperatureC: 25,
  voltageMv: 24000,
  currentMa: 5000,
  lastSeenMs: SEEN_AT,
  uptimeMs: 0,
  lastSeq: 1,
  lost: 0,
  duplicates: 0,
  late: 0,
  reboots: 0,
};

describe("worstLevel", () => {
  it("is OK for no level and picks the most severe otherwise", () => {
    expect(worstLevel([])).toBe("OK");
    expect(worstLevel(["OK", "CRIT", "WARN"])).toBe("CRIT");
  });
});

describe("DeviceStatusEvaluator", () => {
  let clock: FakeClock;
  let evaluator: DeviceStatusEvaluator;

  beforeEach(() => {
    clock = new FakeClock(SEEN_AT);
    evaluator = new DeviceStatusEvaluator(clock, CONFIG.offlineAfterMs, buildStatusRules(CONFIG));
  });

  function statusWith(readings: Partial<DeviceState>): string {
    return evaluator.statusOf({ ...HEALTHY, ...readings });
  }

  it("is OK with nominal readings", () => {
    expect(statusWith({})).toBe("OK");
  });

  it("is OK when no reading was received yet", () => {
    expect(statusWith({ temperatureC: null, voltageMv: null, currentMa: null })).toBe("OK");
  });

  it.each([
    [59.9, "OK"],
    [60, "WARN"],
    [69.9, "WARN"],
    [70, "CRIT"],
  ])("rates a temperature of %s°C as %s", (temperatureC, expected) => {
    expect(statusWith({ temperatureC })).toBe(expected);
  });

  it.each([
    [21999, "WARN"],
    [22000, "OK"],
    [26000, "OK"],
    [26001, "WARN"],
  ])("rates a voltage of %s mV as %s", (voltageMv, expected) => {
    expect(statusWith({ voltageMv })).toBe(expected);
  });

  it.each([
    [10000, "OK"],
    [10001, "WARN"],
  ])("rates a current of %s mA as %s", (currentMa, expected) => {
    expect(statusWith({ currentMa })).toBe(expected);
  });

  it("keeps the worst level when several rules fire", () => {
    expect(statusWith({ temperatureC: 75, currentMa: 12000 })).toBe("CRIT");
  });

  it("becomes OFFLINE once silent for longer than the offline delay", () => {
    clock.advance(CONFIG.offlineAfterMs);
    expect(statusWith({})).toBe("OK");
    clock.advance(1);
    expect(statusWith({ temperatureC: 75 })).toBe("OFFLINE");
  });

  it("accepts an extra rule without changing the existing ones", () => {
    const strict = new DeviceStatusEvaluator(clock, CONFIG.offlineAfterMs, [
      ...buildStatusRules(CONFIG),
      () => "WARN",
    ]);
    expect(strict.statusOf(HEALTHY)).toBe("WARN");
  });
});
