import { METRIC_ID, type MetricId } from "../../protocol/index.js";
import type { Random } from "../ports.js";
import { chance, randomInt } from "../random.js";
import { toDatagram, type Datagram, type FaultStage } from "./stage.js";

/** Abnormal value forced on one metric. */
export interface Anomaly {
  readonly metricId: MetricId;
  readonly value: number;
}

/** Values well outside the hub default thresholds: 85 °C, 20000 mV, 12000 mA. */
export const DEFAULT_ANOMALIES: readonly Anomaly[] = [
  { metricId: METRIC_ID.TEMPERATURE, value: 8500 },
  { metricId: METRIC_ID.VOLTAGE, value: 20000 },
  { metricId: METRIC_ID.CURRENT, value: 12000 },
];

/** Replaces one telemetry value with an abnormal one; must run before byte-level faults. */
export class AnomalyFault implements FaultStage {
  readonly name = "anomaly";
  private count = 0;

  constructor(
    private readonly probability: number,
    private readonly random: Random,
    private readonly anomalies: readonly Anomaly[] = DEFAULT_ANOMALIES,
  ) {}

  get injected(): number {
    return this.count;
  }

  apply(datagram: Datagram): Datagram[] {
    const { frame } = datagram;
    if (frame.measurements.length === 0 || !chance(this.random, this.probability)) {
      return [datagram];
    }
    const anomaly = this.anomalies[randomInt(this.random, 0, this.anomalies.length - 1)];
    if (!anomaly) {
      return [datagram];
    }
    this.count += 1;
    const measurements = frame.measurements.map((measurement) =>
      measurement.metricId === anomaly.metricId ? { ...measurement, value: anomaly.value } : measurement,
    );
    return [toDatagram({ ...frame, measurements })];
  }
}
