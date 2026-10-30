import { FRAME_TYPE, type Frame, type Measurement } from "../protocol/index.js";
import { UINT32_RANGE } from "./limits.js";
import type { Random } from "./ports.js";
import { stepWalk, type MetricWalk } from "./walk.js";

/** Settings shared by every simulated device. */
export interface DeviceOptions {
  readonly heartbeatEvery: number;
  readonly seqStart: number;
  readonly walks: readonly MetricWalk[];
}

interface MetricState {
  readonly walk: MetricWalk;
  value: number;
}

/** Simulated device emitting telemetry frames, with a heartbeat every N-th frame. */
export class Device {
  private seq: number;
  private startMs: number;
  private framesBuilt = 0;
  private readonly metrics: MetricState[];

  constructor(
    readonly deviceId: number,
    private readonly options: DeviceOptions,
    private readonly random: Random,
    nowMs: number,
  ) {
    this.seq = options.seqStart;
    this.startMs = nowMs;
    this.metrics = options.walks.map((walk) => ({ walk, value: walk.nominal }));
  }

  /** Builds the next frame and advances seq, wrapping at 2^32. */
  nextFrame(nowMs: number): Frame {
    this.framesBuilt += 1;
    const isHeartbeat = this.framesBuilt % this.options.heartbeatEvery === 0;
    const frame: Frame = {
      type: isHeartbeat ? FRAME_TYPE.HEARTBEAT : FRAME_TYPE.TELEMETRY,
      deviceId: this.deviceId,
      seq: this.seq,
      uptimeMs: Math.floor(nowMs - this.startMs) % UINT32_RANGE,
      measurements: isHeartbeat ? [] : this.nextMeasurements(),
    };
    this.seq = (this.seq + 1) % UINT32_RANGE;
    return frame;
  }

  /** Simulates a restart: seq and uptime go back to 0. */
  reboot(nowMs: number): void {
    this.seq = 0;
    this.startMs = nowMs;
    this.framesBuilt = 0;
  }

  private nextMeasurements(): Measurement[] {
    return this.metrics.map((metric) => {
      metric.value = stepWalk(metric.value, metric.walk, this.random);
      return { metricId: metric.walk.metricId, value: metric.value };
    });
  }
}

/** Creates devices with ids 1..count. */
export function createDevices(
  count: number,
  options: DeviceOptions,
  random: Random,
  nowMs: number,
): Device[] {
  return Array.from({ length: count }, (_, index) => new Device(index + 1, options, random, nowMs));
}
