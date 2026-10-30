import { describe, expect, it } from "vitest";
import { Sequencer, type SequenceVerdict } from "../../src/hub/sequencer.js";

const DEVICE_A = 7;
const DEVICE_B = 8;
const UINT32_MAX = 0xffffffff;
const UPPER_HALF_SEQ = 3_000_000_000;
const REBOOT_DROP_MS = 1000;
const MAX_GAP = 1000;
const FRAME_PERIOD_MS = 100;

function newSequencer(): Sequencer {
  return new Sequencer({ rebootUptimeDropMs: REBOOT_DROP_MS, maxSeqGap: MAX_GAP });
}

function check(sequencer: Sequencer, deviceId: number, seq: number, uptimeMs = 0): SequenceVerdict {
  return sequencer.check({ deviceId, seq, uptimeMs });
}

function run(sequencer: Sequencer, deviceId: number, seqs: readonly number[]): SequenceVerdict[] {
  return seqs.map((seq) => check(sequencer, deviceId, seq));
}

function accepted(lost: number, rebooted = false): SequenceVerdict {
  return { kind: "accepted", lost, rebooted, resynced: false };
}

const RESYNCED: SequenceVerdict = { kind: "accepted", lost: 0, rebooted: false, resynced: true };

function count(verdicts: readonly SequenceVerdict[], kind: SequenceVerdict["kind"]): number {
  return verdicts.filter((verdict) => verdict.kind === kind).length;
}

function totalLost(verdicts: readonly SequenceVerdict[]): number {
  return verdicts.reduce((sum, verdict) => sum + (verdict.kind === "accepted" ? verdict.lost : 0), 0);
}

describe("Sequencer", () => {
  it("accepts the first frame of a device without counting losses", () => {
    expect(check(newSequencer(), DEVICE_A, 42)).toEqual(accepted(0));
  });

  it("accepts a normal sequence without losses", () => {
    const verdicts = run(newSequencer(), DEVICE_A, [1, 2, 3, 4]);
    expect(count(verdicts, "accepted")).toBe(4);
    expect(totalLost(verdicts)).toBe(0);
  });

  it("discards a repeated seq as duplicate", () => {
    expect(run(newSequencer(), DEVICE_A, [1, 2, 2])[2]).toEqual({ kind: "duplicate" });
  });

  it("discards an older seq as late", () => {
    expect(run(newSequencer(), DEVICE_A, [1, 3, 2])[2]).toEqual({ kind: "late" });
  });

  it("counts the frames missing in a gap", () => {
    expect(run(newSequencer(), DEVICE_A, [1, 5])[1]).toEqual(accepted(3));
  });

  it("gives 2 lost, 1 late and 1 duplicate for 1, 2, 5, 3, 5, 6", () => {
    const verdicts = run(newSequencer(), DEVICE_A, [1, 2, 5, 3, 5, 6]);
    expect(totalLost(verdicts)).toBe(2);
    expect(count(verdicts, "late")).toBe(1);
    expect(count(verdicts, "duplicate")).toBe(1);
    expect(count(verdicts, "accepted")).toBe(4);
  });

  describe("uint32 wraparound", () => {
    it("treats 0 after 0xFFFFFFFF as the next frame", () => {
      expect(run(newSequencer(), DEVICE_A, [UINT32_MAX, 0])[1]).toEqual(accepted(0));
    });

    it("counts the gap across the wrap", () => {
      expect(run(newSequencer(), DEVICE_A, [UINT32_MAX - 1, 2])[1]).toEqual(accepted(3));
    });

    it("discards a frame from before the wrap as late", () => {
      expect(run(newSequencer(), DEVICE_A, [UINT32_MAX - 1, 1, UINT32_MAX])[2]).toEqual({ kind: "late" });
    });
  });

  describe("resync", () => {
    it("counts a gap up to the maximum as lost", () => {
      expect(run(newSequencer(), DEVICE_A, [1, 1 + MAX_GAP])[1]).toEqual(accepted(MAX_GAP - 1));
    });

    it("resyncs on a jump ahead beyond the maximum gap without counting losses", () => {
      const verdicts = run(newSequencer(), DEVICE_A, [1, 2 + MAX_GAP, 3 + MAX_GAP]);
      expect(verdicts).toEqual([accepted(0), RESYNCED, accepted(0)]);
    });

    it("keeps accepting frames after a huge jump instead of classing them late", () => {
      const verdicts = run(newSequencer(), DEVICE_A, [1, UPPER_HALF_SEQ, UPPER_HALF_SEQ + 1, UPPER_HALF_SEQ + 2]);
      expect(verdicts.slice(1)).toEqual([RESYNCED, accepted(0), accepted(0)]);
    });

    it("discards a seq up to the maximum gap behind as late", () => {
      expect(run(newSequencer(), DEVICE_A, [5000, 5000 - MAX_GAP])[1]).toEqual({ kind: "late" });
    });

    it("resyncs when the seq drops back beyond the maximum gap", () => {
      const verdicts = run(newSequencer(), DEVICE_A, [5000, 1, 2]);
      expect(verdicts.slice(1)).toEqual([RESYNCED, accepted(0)]);
    });

    it("resyncs on a seq reset to 0 from the upper half when the uptime drop is too small for a reboot", () => {
      const sequencer = newSequencer();
      check(sequencer, DEVICE_A, UPPER_HALF_SEQ, REBOOT_DROP_MS / 2);
      expect(check(sequencer, DEVICE_A, 0, FRAME_PERIOD_MS)).toEqual(RESYNCED);
      expect(check(sequencer, DEVICE_A, 1, 2 * FRAME_PERIOD_MS)).toEqual(accepted(0));
    });

    it("keeps small gaps across the wrap unchanged", () => {
      expect(run(newSequencer(), DEVICE_A, [UINT32_MAX - 1, 2])[1]).toEqual(accepted(3));
      expect(run(newSequencer(), DEVICE_A, [1, UINT32_MAX])[1]).toEqual({ kind: "late" });
    });
  });

  describe("reboot detection", () => {
    it("resets the baseline when the uptime drops by more than the threshold", () => {
      const sequencer = newSequencer();
      check(sequencer, DEVICE_A, 500, 60_000);
      expect(check(sequencer, DEVICE_A, 1, 200)).toEqual(accepted(0, true));
      expect(check(sequencer, DEVICE_A, 2, 300)).toEqual(accepted(0));
    });

    it("counts losses from the new baseline after a reboot", () => {
      const sequencer = newSequencer();
      check(sequencer, DEVICE_A, 500, 60_000);
      check(sequencer, DEVICE_A, 0, 0);
      expect(check(sequencer, DEVICE_A, 3, 3 * FRAME_PERIOD_MS)).toEqual(accepted(2));
    });

    it("tolerates an uptime drop up to the threshold", () => {
      const sequencer = newSequencer();
      check(sequencer, DEVICE_A, 10, 5000);
      expect(check(sequencer, DEVICE_A, 9, 5000 - REBOOT_DROP_MS)).toEqual({ kind: "late" });
    });
  });

  it("tracks each device independently", () => {
    const sequencer = newSequencer();
    check(sequencer, DEVICE_A, 100);
    expect(check(sequencer, DEVICE_B, 1)).toEqual(accepted(0));
    expect(check(sequencer, DEVICE_A, 101)).toEqual(accepted(0));
  });
});
