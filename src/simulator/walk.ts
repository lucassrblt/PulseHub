import { METRIC_ID, type MetricId } from "../protocol/index.js";
import type { Random } from "./ports.js";
import { randomInt } from "./random.js";

/** Bounded random walk of one metric, in the metric unit. */
export interface MetricWalk {
  readonly metricId: MetricId;
  readonly nominal: number;
  readonly step: number;
  readonly min: number;
  readonly max: number;
}

/** Nominal telemetry: temperature in hundredths of °C, voltage in mV, current in mA. */
export const NOMINAL_WALKS: readonly MetricWalk[] = [
  { metricId: METRIC_ID.TEMPERATURE, nominal: 4000, step: 5, min: 2500, max: 5500 },
  { metricId: METRIC_ID.VOLTAGE, nominal: 24000, step: 50, min: 23000, max: 25000 },
  { metricId: METRIC_ID.CURRENT, nominal: 3000, step: 50, min: 1000, max: 6000 },
];

/** Next value of the walk: moves by at most one step and stays within [min, max]. */
export function stepWalk(current: number, walk: MetricWalk, random: Random): number {
  const next = current + randomInt(random, -walk.step, walk.step);
  return Math.min(walk.max, Math.max(walk.min, next));
}
