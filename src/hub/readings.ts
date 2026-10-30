import { METRIC_ID, type Measurement, type MetricId } from "../protocol/index.js";

/** Latest metric values of a device, null until the metric has been received. */
export interface DeviceReadings {
  readonly temperatureC: number | null;
  readonly voltageMv: number | null;
  readonly currentMa: number | null;
}

const HUNDREDTHS_PER_DEGREE = 100;

const READING_OF_METRIC: Readonly<Record<MetricId, (value: number) => Partial<DeviceReadings>>> = {
  [METRIC_ID.TEMPERATURE]: (value) => ({ temperatureC: value / HUNDREDTHS_PER_DEGREE }),
  [METRIC_ID.VOLTAGE]: (value) => ({ voltageMv: value }),
  [METRIC_ID.CURRENT]: (value) => ({ currentMa: value }),
};

/** Readings carried by the measurements of a frame; metrics absent from the frame are omitted. */
export function readingsOf(measurements: readonly Measurement[]): Partial<DeviceReadings> {
  return measurements.reduce<Partial<DeviceReadings>>(
    (readings, measurement) => ({ ...readings, ...READING_OF_METRIC[measurement.metricId](measurement.value) }),
    {},
  );
}
