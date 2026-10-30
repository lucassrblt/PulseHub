import type { HubConfig } from "./config.js";
import { levelFromThresholds, type HealthLevel } from "./health.js";
import type { DeviceReadings } from "./readings.js";

/** One independent check of a device's readings; a missing reading is OK. */
export type StatusRule = (readings: DeviceReadings) => HealthLevel;

/** Thresholds used by the status rules. */
export type StatusThresholds = Pick<
  HubConfig,
  "tempWarnC" | "tempCritC" | "voltageMinMv" | "voltageMaxMv" | "currentMaxMa"
>;

/** WARN at or above warn, CRIT at or above crit. */
export function temperatureRule(warnC: number, critC: number): StatusRule {
  return ({ temperatureC }) => (temperatureC === null ? "OK" : levelFromThresholds(temperatureC, warnC, critC));
}

/** WARN outside [minMv, maxMv]. */
export function voltageRule(minMv: number, maxMv: number): StatusRule {
  return ({ voltageMv }) => (voltageMv !== null && (voltageMv < minMv || voltageMv > maxMv) ? "WARN" : "OK");
}

/** WARN above maxMa. */
export function currentRule(maxMa: number): StatusRule {
  return ({ currentMa }) => (currentMa !== null && currentMa > maxMa ? "WARN" : "OK");
}

/** Status rules built from the configured thresholds. */
export function buildStatusRules(thresholds: StatusThresholds): readonly StatusRule[] {
  return [
    temperatureRule(thresholds.tempWarnC, thresholds.tempCritC),
    voltageRule(thresholds.voltageMinMv, thresholds.voltageMaxMv),
    currentRule(thresholds.currentMaxMa),
  ];
}
