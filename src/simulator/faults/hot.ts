import { METRIC_ID } from "../../protocol/index.js";
import { MS_PER_SECOND, type Clock } from "../../shared/time.js";
import { toDatagram, type Datagram, type FaultStage } from "./stage.js";

/** How a hot device heats up, in hundredths of °C. */
export interface HeatProfile {
  readonly target: number;
  readonly risePerSecond: number;
}

/** Heats up to 85 °C at 20 °C per second, well above the hub default critical threshold. */
export const DEFAULT_HEAT_PROFILE: HeatProfile = { target: 8500, risePerSecond: 2000 };

/** Ramps the temperature of the hot devices up to the target once the hot time is reached, then holds it. */
export class HotFault implements FaultStage {
  readonly name = "hot";
  private count = 0;

  constructor(
    private readonly hotIds: ReadonlySet<number>,
    private readonly hotAtMs: number,
    private readonly clock: Clock,
    private readonly profile: HeatProfile = DEFAULT_HEAT_PROFILE,
  ) {}

  get injected(): number {
    return this.count;
  }

  apply(datagram: Datagram): Datagram[] {
    const { frame } = datagram;
    const elapsedMs = this.clock.now() - this.hotAtMs;
    const hasTemperature = frame.measurements.some((measurement) => measurement.metricId === METRIC_ID.TEMPERATURE);
    if (!this.hotIds.has(frame.deviceId) || elapsedMs < 0 || !hasTemperature) {
      return [datagram];
    }
    this.count += 1;
    const rise = (elapsedMs * this.profile.risePerSecond) / MS_PER_SECOND;
    const measurements = frame.measurements.map((measurement) =>
      measurement.metricId === METRIC_ID.TEMPERATURE
        ? { ...measurement, value: Math.round(Math.min(this.profile.target, measurement.value + rise)) }
        : measurement,
    );
    return [toDatagram({ ...frame, measurements })];
  }
}
