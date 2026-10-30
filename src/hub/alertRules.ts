import type { StatusThresholds } from "./statusRules.js";
import type { DeviceReadings } from "./readings.js";

/** Condition that raises an alert once it has held long enough. */
export interface AlertRule {
  readonly id: string;
  readonly label: string;
  isTriggered(readings: DeviceReadings): boolean;
}

/** Alert rules built from the configured thresholds. */
export function buildAlertRules(thresholds: StatusThresholds): readonly AlertRule[] {
  return [
    {
      id: "temperature-critical",
      label: `Temperature above ${thresholds.tempCritC} °C`,
      isTriggered: ({ temperatureC }) => temperatureC !== null && temperatureC > thresholds.tempCritC,
    },
    {
      id: "voltage-out-of-range",
      label: `Voltage outside ${thresholds.voltageMinMv}-${thresholds.voltageMaxMv} mV`,
      isTriggered: ({ voltageMv }) =>
        voltageMv !== null && (voltageMv < thresholds.voltageMinMv || voltageMv > thresholds.voltageMaxMv),
    },
    {
      id: "overcurrent",
      label: `Current above ${thresholds.currentMaxMa} mA`,
      isTriggered: ({ currentMa }) => currentMa !== null && currentMa > thresholds.currentMaxMa,
    },
  ];
}
