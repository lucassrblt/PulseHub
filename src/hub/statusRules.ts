import type { HealthLevel } from "./health.js";
import type { DeviceReadings } from "./readings.js";
import { buildThresholdPredicates, type ReadingPredicate, type Thresholds } from "./thresholds.js";

/** One independent check of a device's readings; a missing reading is OK. */
export type StatusRule = (readings: DeviceReadings) => HealthLevel;

/** Rule returning the level when the predicate holds, OK otherwise. */
export function levelWhen(predicate: ReadingPredicate, level: HealthLevel): StatusRule {
  return (readings) => (predicate(readings) ? level : "OK");
}

/** Status rules built from the threshold predicates: CRIT temperature, WARN temperature, voltage and current. */
export function buildStatusRules(thresholds: Thresholds): readonly StatusRule[] {
  const breaks = buildThresholdPredicates(thresholds);
  return [
    levelWhen(breaks.temperatureCrit, "CRIT"),
    levelWhen(breaks.temperatureWarn, "WARN"),
    levelWhen(breaks.voltageOutOfRange, "WARN"),
    levelWhen(breaks.overcurrent, "WARN"),
  ];
}
