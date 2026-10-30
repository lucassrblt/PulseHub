import { beforeEach, describe, expect, it } from "vitest";
import { DeviceRegistry } from "../../src/hub/deviceRegistry.js";
import { FakeClock } from "./fakeClock.js";
import { NOMINAL, heartbeat, telemetry } from "./frames.js";

const DEVICE = 7;
const ACCEPTED = { kind: "accepted", lost: 0, rebooted: false } as const;

describe("DeviceRegistry", () => {
  let clock: FakeClock;
  let registry: DeviceRegistry;

  beforeEach(() => {
    clock = new FakeClock(1000);
    registry = new DeviceRegistry(clock);
  });

  it("starts empty", () => {
    expect(registry.list()).toEqual([]);
  });

  it("stores the readings of an accepted telemetry frame in device units", () => {
    const device = registry.record(telemetry(DEVICE, 1, { tenthsC: 653, mv: 24100, ma: 1200 }, 5000), ACCEPTED);
    expect(device).toEqual({
      deviceId: DEVICE,
      temperatureC: 65.3,
      voltageMv: 24100,
      currentMa: 1200,
      lastSeenMs: 1000,
      uptimeMs: 5000,
      lastSeq: 1,
      lost: 0,
      duplicates: 0,
      late: 0,
      reboots: 0,
    });
  });

  it("keeps the last readings on a heartbeat but refreshes last seen and uptime", () => {
    registry.record(telemetry(DEVICE, 1, NOMINAL), ACCEPTED);
    clock.advance(500);
    const device = registry.record(heartbeat(DEVICE, 2, 9000), ACCEPTED);
    expect(device).toMatchObject({ temperatureC: 25, voltageMv: 24000, currentMa: 5000 });
    expect(device).toMatchObject({ lastSeenMs: 1500, uptimeMs: 9000, lastSeq: 2 });
  });

  it("accumulates lost, duplicate and late counters per device", () => {
    registry.record(heartbeat(DEVICE, 1), ACCEPTED);
    registry.record(heartbeat(DEVICE, 5), { kind: "accepted", lost: 3, rebooted: false });
    registry.record(heartbeat(DEVICE, 5), { kind: "duplicate" });
    const device = registry.record(heartbeat(DEVICE, 4), { kind: "late" });
    expect(device).toMatchObject({ lost: 3, duplicates: 1, late: 1, lastSeq: 5 });
  });

  it("counts reboots and takes the new seq as baseline", () => {
    registry.record(heartbeat(DEVICE, 500), ACCEPTED);
    const device = registry.record(heartbeat(DEVICE, 1), { kind: "accepted", lost: 0, rebooted: true });
    expect(device).toMatchObject({ reboots: 1, lastSeq: 1 });
  });

  it("does not refresh last seen on a discarded frame", () => {
    registry.record(heartbeat(DEVICE, 1), ACCEPTED);
    clock.advance(500);
    expect(registry.record(heartbeat(DEVICE, 1), { kind: "duplicate" }).lastSeenMs).toBe(1000);
  });
});
