import type { Frame } from "../protocol/index.js";
import type { Clock } from "./clock.js";
import { NO_READINGS, readingsOf, type DeviceReadings } from "./readings.js";
import type { SequenceVerdict } from "./sequencer.js";
import type { ReadingPredicate } from "./thresholds.js";

/** Everything the hub knows about one device. */
export interface DeviceState extends DeviceReadings {
  readonly deviceId: number;
  readonly lastSeenMs: number;
  readonly uptimeMs: number;
  readonly lastSeq: number;
  readonly lost: number;
  readonly duplicates: number;
  readonly late: number;
  readonly reboots: number;
  readonly resyncs: number;
  readonly outOfRange: number;
}

/** Write side of the registry, used by the frame pipeline. */
export interface DeviceRecorder {
  record(frame: Frame, verdict: SequenceVerdict): DeviceState;
}

/** Read side of the registry, used by the snapshot. */
export interface DeviceSource {
  list(): readonly DeviceState[];
}

/** Keeps the latest state of every device that sent a valid frame and counts its out-of-range telemetry frames. */
export class DeviceRegistry implements DeviceRecorder, DeviceSource {
  private readonly devices = new Map<number, DeviceState>();

  constructor(
    private readonly clock: Clock,
    private readonly isOutOfRange: ReadingPredicate,
  ) {}

  record(frame: Frame, verdict: SequenceVerdict): DeviceState {
    const previous = this.devices.get(frame.deviceId) ?? this.emptyState(frame);
    const next = this.applyVerdict(previous, frame, verdict);
    this.devices.set(frame.deviceId, next);
    return next;
  }

  list(): readonly DeviceState[] {
    return [...this.devices.values()];
  }

  private applyVerdict(device: DeviceState, frame: Frame, verdict: SequenceVerdict): DeviceState {
    if (verdict.kind === "duplicate") {
      return { ...device, duplicates: device.duplicates + 1 };
    }
    if (verdict.kind === "late") {
      return { ...device, late: device.late + 1 };
    }
    const frameReadings = readingsOf(frame.measurements);
    return {
      ...device,
      ...frameReadings,
      lastSeenMs: this.clock.now(),
      uptimeMs: frame.uptimeMs,
      lastSeq: frame.seq,
      lost: device.lost + verdict.lost,
      reboots: verdict.rebooted ? device.reboots + 1 : device.reboots,
      resyncs: verdict.resynced ? device.resyncs + 1 : device.resyncs,
      outOfRange: this.isOutOfRange({ ...NO_READINGS, ...frameReadings }) ? device.outOfRange + 1 : device.outOfRange,
    };
  }

  private emptyState(frame: Frame): DeviceState {
    return {
      deviceId: frame.deviceId,
      ...NO_READINGS,
      lastSeenMs: this.clock.now(),
      uptimeMs: frame.uptimeMs,
      lastSeq: frame.seq,
      lost: 0,
      duplicates: 0,
      late: 0,
      reboots: 0,
      resyncs: 0,
      outOfRange: 0,
    };
  }
}
