import { describe, expect, it } from "vitest";
import { FRAME_TYPE, METRIC_ID } from "../../src/protocol/index.js";
import { Device, createDevices, type DeviceOptions } from "../../src/simulator/device.js";
import { NOMINAL_WALKS } from "../../src/simulator/walk.js";
import { seededRandom } from "./fakes.js";

const OPTIONS: DeviceOptions = { heartbeatEvery: 4, seqStart: 0, walks: NOMINAL_WALKS };

function newDevice(options: Partial<DeviceOptions> = {}): Device {
  return new Device(7, { ...OPTIONS, ...options }, seededRandom(1), 0);
}

describe("Device", () => {
  it("emits consecutive seq values starting at seqStart", () => {
    const device = newDevice({ seqStart: 10 });
    const seqs = [0, 1, 2, 3, 4].map((tick) => device.nextFrame(tick).seq);
    expect(seqs).toEqual([10, 11, 12, 13, 14]);
  });

  it("wraps seq at 2^32", () => {
    const device = newDevice({ seqStart: 4294967294 });
    const seqs = [0, 1, 2, 3].map((tick) => device.nextFrame(tick).seq);
    expect(seqs).toEqual([4294967294, 4294967295, 0, 1]);
  });

  it("sends a heartbeat every heartbeatEvery frames and telemetry otherwise", () => {
    const device = newDevice();
    const types = Array.from({ length: 8 }, (_, tick) => device.nextFrame(tick).type);
    const { TELEMETRY: T, HEARTBEAT: H } = FRAME_TYPE;
    expect(types).toEqual([T, T, T, H, T, T, T, H]);
  });

  it("puts temperature, voltage and current in telemetry and nothing in heartbeats", () => {
    const device = newDevice({ heartbeatEvery: 2 });
    const telemetry = device.nextFrame(0);
    const heartbeat = device.nextFrame(1);
    expect(telemetry.measurements.map((m) => m.metricId)).toEqual([
      METRIC_ID.TEMPERATURE,
      METRIC_ID.VOLTAGE,
      METRIC_ID.CURRENT,
    ]);
    expect(heartbeat.measurements).toEqual([]);
  });

  it("keeps nominal values within their walk bounds", () => {
    const device = newDevice({ heartbeatEvery: 1000 });
    for (let tick = 0; tick < 5000; tick++) {
      device.nextFrame(tick).measurements.forEach((measurement, index) => {
        const walk = NOMINAL_WALKS[index];
        expect(measurement.value).toBeGreaterThanOrEqual(walk?.min ?? Number.NaN);
        expect(measurement.value).toBeLessThanOrEqual(walk?.max ?? Number.NaN);
      });
    }
  });

  it("reports uptime since start and resets seq and uptime on reboot", () => {
    const device = new Device(1, { ...OPTIONS, seqStart: 50 }, seededRandom(1), 1000);
    expect(device.nextFrame(1250)).toMatchObject({ seq: 50, uptimeMs: 250 });
    device.reboot(2000);
    expect(device.nextFrame(2100)).toMatchObject({ seq: 0, uptimeMs: 100 });
  });
});

describe("createDevices", () => {
  it("numbers devices from 1 to count", () => {
    const ids = createDevices(3, OPTIONS, seededRandom(1), 0).map((device) => device.deviceId);
    expect(ids).toEqual([1, 2, 3]);
  });
});
