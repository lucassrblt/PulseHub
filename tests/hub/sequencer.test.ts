import { describe, expect, it } from "vitest";
import { Sequencer, type SequenceVerdict } from "../../src/hub/sequencer.js";

const DEVICE_A = 7;
const DEVICE_B = 8;
const UINT32_MAX = 0xffffffff;
const HALF_RANGE = 2 ** 31;

function run(sequencer: Sequencer, deviceId: number, seqs: readonly number[]): SequenceVerdict[] {
  return seqs.map((seq) => sequencer.check({ deviceId, seq }));
}

function count(verdicts: readonly SequenceVerdict[], kind: SequenceVerdict["kind"]): number {
  return verdicts.filter((verdict) => verdict.kind === kind).length;
}

function totalLost(verdicts: readonly SequenceVerdict[]): number {
  return verdicts.reduce((sum, verdict) => sum + (verdict.kind === "accepted" ? verdict.lost : 0), 0);
}

describe("Sequencer", () => {
  it("accepts the first frame of a device without counting losses", () => {
    expect(new Sequencer().check({ deviceId: DEVICE_A, seq: 42 })).toEqual({ kind: "accepted", lost: 0 });
  });

  it("accepts a normal sequence without losses", () => {
    const verdicts = run(new Sequencer(), DEVICE_A, [1, 2, 3, 4]);
    expect(count(verdicts, "accepted")).toBe(4);
    expect(totalLost(verdicts)).toBe(0);
  });

  it("discards a repeated seq as duplicate", () => {
    expect(run(new Sequencer(), DEVICE_A, [1, 2, 2])[2]).toEqual({ kind: "duplicate" });
  });

  it("discards an older seq as late", () => {
    expect(run(new Sequencer(), DEVICE_A, [1, 3, 2])[2]).toEqual({ kind: "late" });
  });

  it("counts the frames missing in a gap", () => {
    expect(run(new Sequencer(), DEVICE_A, [1, 5])[1]).toEqual({ kind: "accepted", lost: 3 });
  });

  it("gives 2 lost, 1 late and 1 duplicate for 1, 2, 5, 3, 5, 6", () => {
    const verdicts = run(new Sequencer(), DEVICE_A, [1, 2, 5, 3, 5, 6]);
    expect(totalLost(verdicts)).toBe(2);
    expect(count(verdicts, "late")).toBe(1);
    expect(count(verdicts, "duplicate")).toBe(1);
    expect(count(verdicts, "accepted")).toBe(4);
  });

  describe("uint32 wraparound", () => {
    it("treats 0 after 0xFFFFFFFF as the next frame", () => {
      expect(run(new Sequencer(), DEVICE_A, [UINT32_MAX, 0])[1]).toEqual({ kind: "accepted", lost: 0 });
    });

    it("counts the gap across the wrap", () => {
      expect(run(new Sequencer(), DEVICE_A, [UINT32_MAX - 1, 2])[1]).toEqual({ kind: "accepted", lost: 3 });
    });

    it("discards a frame from before the wrap as late", () => {
      expect(run(new Sequencer(), DEVICE_A, [UINT32_MAX - 1, 1, UINT32_MAX])[2]).toEqual({ kind: "late" });
    });

    it("considers a seq half the range away or more as late", () => {
      expect(run(new Sequencer(), DEVICE_A, [0, HALF_RANGE])[1]).toEqual({ kind: "late" });
      expect(run(new Sequencer(), DEVICE_A, [0, HALF_RANGE - 1])[1]).toEqual({
        kind: "accepted",
        lost: HALF_RANGE - 2,
      });
    });
  });

  it("tracks each device independently", () => {
    const sequencer = new Sequencer();
    sequencer.check({ deviceId: DEVICE_A, seq: 100 });
    expect(sequencer.check({ deviceId: DEVICE_B, seq: 1 })).toEqual({ kind: "accepted", lost: 0 });
    expect(sequencer.check({ deviceId: DEVICE_A, seq: 101 })).toEqual({ kind: "accepted", lost: 0 });
  });
});
