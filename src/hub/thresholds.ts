import type { HubConfig } from "./config.js";
import type { DeviceReadings } from "./readings.js";

/** Configured reading thresholds. */
export type Thresholds = Pick<HubConfig, "tempWarnC" | "tempCritC" | "voltageMinMv" | "voltageMaxMv" | "currentMaxMa">;

/** Configured thresholds as named in the snapshot, so the visualization follows the config. */
export interface ThresholdLimits {
  readonly temperatureWarnC: number;
  readonly temperatureCritC: number;
  readonly voltageMinMv: number;
  readonly voltageMaxMv: number;
  readonly currentMaxMa: number;
}

/** Whether the readings break a threshold; a missing reading never does. */
export type ReadingPredicate = (readings: DeviceReadings) => boolean;

/** One predicate per threshold, the single source used by the status rules and the alert rules. */
export interface ThresholdPredicates {
  readonly temperatureWarn: ReadingPredicate;
  readonly temperatureCrit: ReadingPredicate;
  readonly voltageOutOfRange: ReadingPredicate;
  readonly overcurrent: ReadingPredicate;
}

/** Predicate holding when the readings break any WARN or CRIT threshold. */
export function buildOutOfRangePredicate(thresholds: Thresholds): ReadingPredicate {
  const predicates = Object.values(buildThresholdPredicates(thresholds));
  return (readings) => predicates.some((breaks) => breaks(readings));
}

/** Temperature at or above warn or crit, voltage outside [min, max], current above max. */
export function buildThresholdPredicates(thresholds: Thresholds): ThresholdPredicates {
  return {
    temperatureWarn: ({ temperatureC }) => temperatureC !== null && temperatureC >= thresholds.tempWarnC,
    temperatureCrit: ({ temperatureC }) => temperatureC !== null && temperatureC >= thresholds.tempCritC,
    voltageOutOfRange: ({ voltageMv }) =>
      voltageMv !== null && (voltageMv < thresholds.voltageMinMv || voltageMv > thresholds.voltageMaxMv),
    overcurrent: ({ currentMa }) => currentMa !== null && currentMa > thresholds.currentMaxMa,
  };
}

/** Thresholds renamed for the snapshot. */
export function thresholdLimits(thresholds: Thresholds): ThresholdLimits {
  return {
    temperatureWarnC: thresholds.tempWarnC,
    temperatureCritC: thresholds.tempCritC,
    voltageMinMv: thresholds.voltageMinMv,
    voltageMaxMv: thresholds.voltageMaxMv,
    currentMaxMa: thresholds.currentMaxMa,
  };
}
