import type { DeviceReadings } from "./readings.js";
import { buildThresholdPredicates, type Thresholds } from "./thresholds.js";

/** Condition that raises an alert once it has held long enough. */
export interface AlertRule {
  readonly id: string;
  readonly label: string;
  isTriggered(readings: DeviceReadings): boolean;
}

/** Alert rules built from the same threshold predicates as the status rules. */
export function buildAlertRules(thresholds: Thresholds): readonly AlertRule[] {
  const breaks = buildThresholdPredicates(thresholds);
  return [
    {
      id: "temperature-critical",
      label: `Temperature at or above ${thresholds.tempCritC} °C`,
      isTriggered: breaks.temperatureCrit,
    },
    {
      id: "voltage-out-of-range",
      label: `Voltage outside ${thresholds.voltageMinMv}-${thresholds.voltageMaxMv} mV`,
      isTriggered: breaks.voltageOutOfRange,
    },
    {
      id: "overcurrent",
      label: `Current above ${thresholds.currentMaxMa} mA`,
      isTriggered: breaks.overcurrent,
    },
  ];
}
