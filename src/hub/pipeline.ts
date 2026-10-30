import type { DecodeError, DecodedFrame, Result } from "../protocol/index.js";
import type { AlertTracker } from "./alertEngine.js";
import type { DeviceRecorder } from "./deviceRegistry.js";
import type { ReceptionRecorder } from "./receptionStats.js";
import type { FrameSequencer } from "./sequencer.js";

/** Turns raw bytes into a frame or a decode error. */
export type FrameDecoder = (bytes: Uint8Array) => Result<DecodedFrame, DecodeError>;

/** Collaborators of the frame pipeline. */
export interface PipelineDeps {
  readonly decode: FrameDecoder;
  readonly stats: ReceptionRecorder;
  readonly sequencer: FrameSequencer;
  readonly devices: DeviceRecorder;
  readonly alerts: AlertTracker;
}

/** Per-datagram flow: decode, sequence, then update the device and its alerts. */
export class FramePipeline {
  constructor(private readonly deps: PipelineDeps) {}

  handle(bytes: Uint8Array): void {
    this.deps.stats.recordReceived();
    const decoded = this.deps.decode(bytes);
    if (!decoded.ok) {
      this.deps.stats.recordInvalid(decoded.error.reason);
      return;
    }
    this.deps.stats.recordUnknownMetrics(decoded.value.skippedMeasurements);
    const verdict = this.deps.sequencer.check(decoded.value);
    this.deps.stats.recordVerdict(verdict);
    const device = this.deps.devices.record(decoded.value, verdict);
    if (verdict.kind === "accepted") {
      this.deps.alerts.evaluate(device);
    }
  }
}
