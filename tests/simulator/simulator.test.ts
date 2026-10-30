import { describe, expect, it } from "vitest";
import { decodeFrame, type Frame } from "../../src/protocol/index.js";
import { createDevices } from "../../src/simulator/device.js";
import { DuplicateFault } from "../../src/simulator/faults/duplicate.js";
import type { FaultStage } from "../../src/simulator/faults/stage.js";
import { Simulator } from "../../src/simulator/simulator.js";
import { NOMINAL_WALKS } from "../../src/simulator/walk.js";
import { FakeClock, FakeTimer, RecordingSender, constantRandom, seededRandom } from "./fakes.js";

const DEVICES = 2;
const HZ = 10;
const PERIOD_MS = 1000 / HZ;
const TICK_MS = 10;

function setup(stages: FaultStage[] = []): { clock: FakeClock; timer: FakeTimer; sender: RecordingSender; simulator: Simulator } {
  const clock = new FakeClock(0);
  const timer = new FakeTimer();
  const sender = new RecordingSender();
  const options = { heartbeatEvery: 3, seqStart: 0, walks: NOMINAL_WALKS };
  const devices = createDevices(DEVICES, options, seededRandom(42), clock.now());
  const simulator = new Simulator({
    devices,
    deviceFaults: [],
    stages,
    sender,
    clock,
    timer,
    periodMs: PERIOD_MS,
    tickMs: TICK_MS,
  });
  return { clock, timer, sender, simulator };
}

function runFor(clock: FakeClock, timer: FakeTimer, durationMs: number): void {
  for (let elapsed = 0; elapsed < durationMs; elapsed += TICK_MS) {
    clock.nowMs = elapsed;
    timer.fire();
  }
}

function decodeAll(sent: Uint8Array[]): Frame[] {
  return sent.map((bytes) => {
    const decoded = decodeFrame(bytes);
    if (!decoded.ok) {
      throw new Error(decoded.error.message);
    }
    return decoded.value;
  });
}

describe("Simulator", () => {
  it("emits devices x hz frames per second, all decodable", () => {
    const { clock, timer, sender, simulator } = setup();
    simulator.start();
    runFor(clock, timer, 1000);

    expect(sender.sent).toHaveLength(DEVICES * HZ);
    expect(simulator.framesSent).toBe(DEVICES * HZ);
    const frames = decodeAll(sender.sent);
    for (let deviceId = 1; deviceId <= DEVICES; deviceId++) {
      const seqs = frames.filter((frame) => frame.deviceId === deviceId).map((frame) => frame.seq);
      expect(seqs).toEqual(Array.from({ length: HZ }, (_, index) => index));
    }
  });

  it("sends every datagram produced by the stages", () => {
    const { clock, timer, sender, simulator } = setup([new DuplicateFault(1, constantRandom(0))]);
    simulator.start();
    runFor(clock, timer, 1000);
    expect(sender.sent).toHaveLength(2 * DEVICES * HZ);
  });

  it("emits nothing after stop", () => {
    const { clock, timer, sender, simulator } = setup();
    simulator.start();
    runFor(clock, timer, 500);
    const before = sender.sent.length;
    simulator.stop();
    runFor(clock, timer, 1000);
    expect(sender.sent).toHaveLength(before);
  });
});
