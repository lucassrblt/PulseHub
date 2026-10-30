import type { Frame } from "../protocol/index.js";

const SEQ_MODULUS = 2 ** 32;
const HALF_SEQ_RANGE = 2 ** 31;

/** Steps from one uint32 seq to the next one, modulo 2^32 (RFC 1982 serial number arithmetic). */
export function forwardDistance(from: number, to: number): number {
  return (to - from + SEQ_MODULUS) % SEQ_MODULUS;
}

/** Outcome of the sequence check for one valid frame. */
export type SequenceVerdict =
  | { readonly kind: "accepted"; readonly lost: number; readonly rebooted: boolean }
  | { readonly kind: "duplicate" }
  | { readonly kind: "late" };

/** Frame fields the sequencer relies on. */
export type SequencedFrame = Pick<Frame, "deviceId" | "seq" | "uptimeMs">;

/** Decides whether a valid frame is new, a duplicate or late. */
export interface FrameSequencer {
  check(frame: SequencedFrame): SequenceVerdict;
}

interface DeviceSequence {
  readonly lastSeq: number;
  readonly lastUptimeMs: number;
}

/** Tracks the highest accepted seq per device, counts the gaps as losses and detects reboots. */
export class Sequencer implements FrameSequencer {
  private readonly devices = new Map<number, DeviceSequence>();

  constructor(private readonly rebootUptimeDropMs: number) {}

  check(frame: SequencedFrame): SequenceVerdict {
    const last = this.devices.get(frame.deviceId);
    if (last === undefined) {
      return this.accept(frame, 0, false);
    }
    if (last.lastUptimeMs - frame.uptimeMs > this.rebootUptimeDropMs) {
      return this.accept(frame, 0, true);
    }
    const distance = forwardDistance(last.lastSeq, frame.seq);
    if (distance === 0) {
      return { kind: "duplicate" };
    }
    if (distance >= HALF_SEQ_RANGE) {
      return { kind: "late" };
    }
    return this.accept(frame, distance - 1, false);
  }

  private accept(frame: SequencedFrame, lost: number, rebooted: boolean): SequenceVerdict {
    this.devices.set(frame.deviceId, { lastSeq: frame.seq, lastUptimeMs: frame.uptimeMs });
    return { kind: "accepted", lost, rebooted };
  }
}
