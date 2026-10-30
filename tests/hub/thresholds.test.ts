import { describe, expect, it } from "vitest";
import { buildAlertRules } from "../../src/hub/alertRules.js";
import { loadConfig } from "../../src/hub/config.js";
import type { DeviceReadings } from "../../src/hub/readings.js";
import { buildStatusRules } from "../../src/hub/statusRules.js";
import { buildThresholdPredicates, thresholdLimits } from "../../src/hub/thresholds.js";

const CONFIG = loadConfig({});
const breaks = buildThresholdPredicates(CONFIG);
const NO_READINGS: DeviceReadings = { temperatureC: null, voltageMv: null, currentMa: null };

function withReadings(readings: Partial<DeviceReadings>): DeviceReadings {
  return { ...NO_READINGS, ...readings };
}

describe("buildThresholdPredicates", () => {
  it("breaks no threshold without readings", () => {
    Object.values(breaks).forEach((predicate) => expect(predicate(NO_READINGS)).toBe(false));
  });

  it.each([
    [59.9, false, false],
    [60, true, false],
    [69.9, true, false],
    [70, true, true],
  ])("rates %s °C as warn=%s crit=%s", (temperatureC, warn, crit) => {
    expect(breaks.temperatureWarn(withReadings({ temperatureC }))).toBe(warn);
    expect(breaks.temperatureCrit(withReadings({ temperatureC }))).toBe(crit);
  });

  it("flags voltage outside the range and current above the maximum", () => {
    expect(breaks.voltageOutOfRange(withReadings({ voltageMv: 21999 }))).toBe(true);
    expect(breaks.voltageOutOfRange(withReadings({ voltageMv: 26000 }))).toBe(false);
    expect(breaks.overcurrent(withReadings({ currentMa: 10000 }))).toBe(false);
    expect(breaks.overcurrent(withReadings({ currentMa: 10001 }))).toBe(true);
  });
});

describe("status and alert rules", () => {
  it("agree at the critical temperature boundary", () => {
    const atCrit = withReadings({ temperatureC: CONFIG.tempCritC });
    expect(buildStatusRules(CONFIG).map((rule) => rule(atCrit))).toContain("CRIT");
    const alert = buildAlertRules(CONFIG).find((rule) => rule.id === "temperature-critical");
    expect(alert?.isTriggered(atCrit)).toBe(true);
  });
});

describe("thresholdLimits", () => {
  it("names every configured threshold for the snapshot", () => {
    const config = loadConfig({ TEMP_WARN_C: "50", TEMP_CRIT_C: "55", VOLTAGE_MIN_MV: "21000", VOLTAGE_MAX_MV: "25000", CURRENT_MAX_MA: "9000" });
    expect(thresholdLimits(config)).toEqual({
      temperatureWarnC: 50,
      temperatureCritC: 55,
      voltageMinMv: 21_000,
      voltageMaxMv: 25_000,
      currentMaxMa: 9000,
    });
  });
});
