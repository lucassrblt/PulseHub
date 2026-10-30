import type { Frame } from "../protocol/index.js";

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
    if (frame.seq === lastSeq) {
      return { kind: "duplicate" };
    }
    if (frame.seq < lastSeq) {
      return { kind: "late" };
    }
    return this.accept(frame, frame.seq - lastSeq - 1);
  }

  private accept(frame: SequencedFrame, lost: number): SequenceVerdict {
    this.lastSeqByDevice.set(frame.deviceId, frame.seq);
    return { kind: "accepted", lost };
  }
}
