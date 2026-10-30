import type { Frame } from "../protocol/index.js";
import type { Clock } from "./clock.js";
import { readingsOf, type DeviceReadings } from "./readings.js";
import type { SequenceVerdict } from "./sequencer.js";

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
}

/** Write side of the registry, used by the frame pipeline. */
export interface DeviceRecorder {
  record(frame: Frame, verdict: SequenceVerdict): DeviceState;
}

/** Read side of the registry, used by the snapshot. */
export interface DeviceSource {
  list(): readonly DeviceState[];
}

/** Keeps the latest state of every device that sent a valid frame. */
export class DeviceRegistry implements DeviceRecorder, DeviceSource {
  private readonly devices = new Map<number, DeviceState>();

  constructor(private readonly clock: Clock) {}

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
    return {
      ...device,
      ...readingsOf(frame.measurements),
      lastSeenMs: this.clock.now(),
      uptimeMs: frame.uptimeMs,
      lastSeq: frame.seq,
      lost: device.lost + verdict.lost,
      reboots: verdict.rebooted ? device.reboots + 1 : device.reboots,
    };
  }

  private emptyState(frame: Frame): DeviceState {
    return {
      deviceId: frame.deviceId,
      temperatureC: null,
      voltageMv: null,
      currentMa: null,
      lastSeenMs: this.clock.now(),
      uptimeMs: frame.uptimeMs,
      lastSeq: frame.seq,
      lost: 0,
      duplicates: 0,
      late: 0,
      reboots: 0,
    };
  }
}
