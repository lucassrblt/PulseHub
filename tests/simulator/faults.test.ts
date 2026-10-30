import { describe, expect, it } from "vitest";
import { FRAME_TYPE, METRIC_ID, decodeFrame, type Frame } from "../../src/protocol/index.js";
import { AnomalyFault } from "../../src/simulator/faults/anomaly.js";
import { ChecksumFault } from "../../src/simulator/faults/checksum.js";
import { DuplicateFault } from "../../src/simulator/faults/duplicate.js";
import { RebootFault } from "../../src/simulator/faults/reboot.js";
import { ReorderFault } from "../../src/simulator/faults/reorder.js";
import { runStages, toDatagram, type Datagram } from "../../src/simulator/faults/stage.js";
import { StopFault, pickStoppedIds } from "../../src/simulator/faults/stop.js";
import { Device } from "../../src/simulator/device.js";
import { NOMINAL_WALKS } from "../../src/simulator/walk.js";
import { FakeClock, constantRandom, seededRandom } from "./fakes.js";

const ALWAYS = 1;
const NEVER = 0;
const random = constantRandom(0);

function telemetry(deviceId: number, seq: number): Datagram {
  const frame: Frame = {
    type: FRAME_TYPE.TELEMETRY,
    deviceId,
    seq,
    uptimeMs: 0,
    measurements: [
      { metricId: METRIC_ID.TEMPERATURE, value: 4000 },
      { metricId: METRIC_ID.VOLTAGE, value: 24000 },
      { metricId: METRIC_ID.CURRENT, value: 3000 },
    ],
  };
  return toDatagram(frame);
}

function seqsOf(datagrams: Datagram[]): number[] {
  return datagrams.map((datagram) => datagram.frame.seq);
}

describe("ChecksumFault", () => {
  it("makes the decoder reject the frame with BAD_CHECKSUM", () => {
    const [corrupted] = new ChecksumFault(ALWAYS, random).apply(telemetry(1, 0));
    const decoded = decodeFrame(corrupted?.bytes ?? new Uint8Array());
    expect(decoded.ok ? undefined : decoded.error.reason).toBe("BAD_CHECKSUM");
  });

  it("leaves the datagram untouched when it does not fire", () => {
    const datagram = telemetry(1, 0);
    expect(new ChecksumFault(NEVER, random).apply(datagram)).toEqual([datagram]);
  });
});

describe("DuplicateFault", () => {
  it("emits the datagram twice and counts it", () => {
    const fault = new DuplicateFault(ALWAYS, random);
    expect(seqsOf(fault.apply(telemetry(1, 5)))).toEqual([5, 5]);
    expect(fault.injected).toBe(1);
  });
});

describe("ReorderFault", () => {
  it("sends a held datagram after the next one of the same device", () => {
    const fault = new ReorderFault(ALWAYS, random);
    expect(fault.apply(telemetry(1, 0))).toEqual([]);
    expect(seqsOf(fault.apply(telemetry(1, 1)))).toEqual([1, 0]);
  });

  it("does not release a held datagram for another device", () => {
    const fault = new ReorderFault(ALWAYS, random);
    fault.apply(telemetry(1, 0));
    expect(fault.apply(telemetry(2, 0))).toEqual([]);
    expect(seqsOf(fault.apply(telemetry(1, 1)))).toEqual([1, 0]);
  });
});

describe("AnomalyFault", () => {
  it("sends a decodable frame with an out of range temperature", () => {
    const [datagram] = new AnomalyFault(ALWAYS, random).apply(telemetry(1, 0));
    const decoded = decodeFrame(datagram?.bytes ?? new Uint8Array());
    expect(decoded.ok && decoded.value.measurements[0]).toEqual({
      metricId: METRIC_ID.TEMPERATURE,
      value: 8500,
    });
  });

  it("leaves heartbeats untouched", () => {
    const heartbeat = toDatagram({ ...telemetry(1, 0).frame, type: FRAME_TYPE.HEARTBEAT, measurements: [] });
    const fault = new AnomalyFault(ALWAYS, random);
    expect(fault.apply(heartbeat)).toEqual([heartbeat]);
    expect(fault.injected).toBe(0);
  });
});

describe("StopFault", () => {
  it("drops datagrams of stopped devices once the stop time is reached", () => {
    const clock = new FakeClock(0);
    const fault = new StopFault(new Set([2]), 1000, clock);
    expect(fault.apply(telemetry(2, 0))).toHaveLength(1);
    clock.nowMs = 1000;
    expect(fault.apply(telemetry(2, 1))).toEqual([]);
    expect(fault.apply(telemetry(1, 1))).toHaveLength(1);
  });

  it("picks distinct ids within the fleet", () => {
    const ids = pickStoppedIds(5, 10, seededRandom(3));
    expect(new Set(ids).size).toBe(5);
    ids.forEach((id) => expect(id).toBeGreaterThanOrEqual(1));
    ids.forEach((id) => expect(id).toBeLessThanOrEqual(10));
  });
});

describe("RebootFault", () => {
  it("resets seq and uptime of the device", () => {
    const device = new Device(1, { heartbeatEvery: 20, seqStart: 100, walks: NOMINAL_WALKS }, random, 0);
    device.nextFrame(500);
    new RebootFault(ALWAYS, random).beforeFrame(device, 1000);
    expect(device.nextFrame(1000)).toMatchObject({ seq: 0, uptimeMs: 0 });
  });
});

describe("runStages", () => {
  it("chains stages so each one sees the output of the previous one", () => {
    const stages = [new DuplicateFault(ALWAYS, random), new ChecksumFault(ALWAYS, random)];
    const output = runStages(stages, telemetry(1, 0));
    expect(output).toHaveLength(2);
    output.forEach((datagram) => expect(decodeFrame(datagram.bytes).ok).toBe(false));
  });
});
