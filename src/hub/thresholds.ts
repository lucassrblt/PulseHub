import type { HubConfig } from "./config.js";
import type { DeviceReadings } from "./readings.js";

/** Configured reading thresholds. */
export type Thresholds = Pick<HubConfig, "tempWarnC" | "tempCritC" | "voltageMinMv" | "voltageMaxMv" | "currentMaxMa">;

/** Whether the readings break a threshold; a missing reading never does. */
export type ReadingPredicate = (readings: DeviceReadings) => boolean;

/** One predicate per threshold, the single source used by the status rules and the alert rules. */
export interface ThresholdPredicates {
  readonly temperatureWarn: ReadingPredicate;
  readonly temperatureCrit: ReadingPredicate;
  readonly voltageOutOfRange: ReadingPredicate;
  readonly overcurrent: ReadingPredicate;
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
