import type { Frame } from "../protocol/index.js";

const SEQ_MODULUS = 2 ** 32;
const HALF_SEQ_RANGE = 2 ** 31;

/** Steps from one uint32 seq to the next one, modulo 2^32 (RFC 1982 serial number arithmetic). */
export function forwardDistance(from: number, to: number): number {
  return (to - from + SEQ_MODULUS) % SEQ_MODULUS;
}

/** Outcome of the sequence check for one valid frame. */
export type SequenceVerdict =
  | { readonly kind: "accepted"; readonly lost: number }
  | { readonly kind: "duplicate" }
  | { readonly kind: "late" };

/** Frame fields the sequencer relies on. */
export type SequencedFrame = Pick<Frame, "deviceId" | "seq">;

/** Decides whether a valid frame is new, a duplicate or late. */
export interface FrameSequencer {
  check(frame: SequencedFrame): SequenceVerdict;
}

/** Tracks the highest accepted seq per device and counts the gaps as losses. */
export class Sequencer implements FrameSequencer {
  private readonly lastSeqByDevice = new Map<number, number>();

  check(frame: SequencedFrame): SequenceVerdict {
    const lastSeq = this.lastSeqByDevice.get(frame.deviceId);
    if (lastSeq === undefined) {
      return this.accept(frame, 0);
    }
    const distance = forwardDistance(lastSeq, frame.seq);
    if (distance === 0) {
      return { kind: "duplicate" };
    }
    if (distance >= HALF_SEQ_RANGE) {
      return { kind: "late" };
    }
    return this.accept(frame, distance - 1);
  }

  private accept(frame: SequencedFrame, lost: number): SequenceVerdict {
    this.lastSeqByDevice.set(frame.deviceId, frame.seq);
    return { kind: "accepted", lost };
  }
}
