import { UINT32_RANGE, type Frame } from "../protocol/index.js";
import type { HubConfig } from "./config.js";

const HALF_SEQ_RANGE = 2 ** 31;

/** Steps from one uint32 seq to the next one, modulo 2^32 (RFC 1982 serial number arithmetic). */
export function forwardDistance(from: number, to: number): number {
  return (to - from + UINT32_RANGE) % UINT32_RANGE;
}

/** Accepted frame: lost frames in the gap before it, and whether a reboot or a resync reset the baseline. */
export interface AcceptedVerdict {
  readonly kind: "accepted";
  readonly lost: number;
  readonly rebooted: boolean;
  readonly resynced: boolean;
}

/** Outcome of the sequence check for one valid frame. */
export type SequenceVerdict = AcceptedVerdict | { readonly kind: "duplicate" } | { readonly kind: "late" };

/** Frame fields the sequencer relies on. */
export type SequencedFrame = Pick<Frame, "deviceId" | "seq" | "uptimeMs">;

/** Settings needed by the sequencer. */
export type SequencerSettings = Pick<HubConfig, "rebootUptimeDropMs" | "maxSeqGap">;

/** Decides whether a valid frame is new, a duplicate or late. */
export interface FrameSequencer {
  check(frame: SequencedFrame): SequenceVerdict;
}

interface DeviceSequence {
  readonly lastSeq: number;
  readonly lastUptimeMs: number;
}

const NO_RESET = { rebooted: false, resynced: false } as const;

/**
 * Tracks the highest accepted seq per device, counts the gaps as losses and detects reboots.
 * A seq more than maxSeqGap away, forward or backward, resyncs the baseline without counting losses.
 */
export class Sequencer implements FrameSequencer {
  private readonly devices = new Map<number, DeviceSequence>();

  constructor(private readonly settings: SequencerSettings) {}

  check(frame: SequencedFrame): SequenceVerdict {
    const last = this.devices.get(frame.deviceId);
    if (last === undefined) {
      return this.accept(frame, 0, NO_RESET);
    }
    if (last.lastUptimeMs - frame.uptimeMs > this.settings.rebootUptimeDropMs) {
      return this.accept(frame, 0, { ...NO_RESET, rebooted: true });
    }
    const distance = forwardDistance(last.lastSeq, frame.seq);
    if (distance === 0) {
      return { kind: "duplicate" };
    }
    const isBackward = distance >= HALF_SEQ_RANGE;
    const gap = isBackward ? UINT32_RANGE - distance : distance;
    if (gap > this.settings.maxSeqGap) {
      return this.accept(frame, 0, { ...NO_RESET, resynced: true });
    }
    return isBackward ? { kind: "late" } : this.accept(frame, distance - 1, NO_RESET);
  }

  private accept(
    frame: SequencedFrame,
    lost: number,
    reset: Pick<AcceptedVerdict, "rebooted" | "resynced">,
  ): AcceptedVerdict {
    this.devices.set(frame.deviceId, { lastSeq: frame.seq, lastUptimeMs: frame.uptimeMs });
    return { kind: "accepted", lost, ...reset };
  }
}
