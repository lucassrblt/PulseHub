import { beforeEach, describe, expect, it } from "vitest";
import { decodeFrame, encodeFrame } from "../../src/protocol/index.js";
import { AlertEngine } from "../../src/hub/alertEngine.js";
import { buildAlertRules } from "../../src/hub/alertRules.js";
import { loadConfig } from "../../src/hub/config.js";
import { DeviceRegistry } from "../../src/hub/deviceRegistry.js";
import { FramePipeline } from "../../src/hub/pipeline.js";
import { ReceptionStats } from "../../src/hub/receptionStats.js";
import { Sequencer } from "../../src/hub/sequencer.js";
import { FakeClock } from "./fakeClock.js";
import { NOMINAL, heartbeat, telemetry } from "./frames.js";

const CONFIG = loadConfig({});
const DEVICE = 4;

describe("FramePipeline", () => {
  let clock: FakeClock;
  let stats: ReceptionStats;
  let registry: DeviceRegistry;
  let alerts: AlertEngine;
  let pipeline: FramePipeline;

  beforeEach(() => {
    clock = new FakeClock();
    stats = new ReceptionStats(clock, CONFIG);
    registry = new DeviceRegistry(clock);
    alerts = new AlertEngine(clock, buildAlertRules(CONFIG), CONFIG.alertDurationMs);
    pipeline = new FramePipeline({
      decode: decodeFrame,
      stats,
      sequencer: new Sequencer(CONFIG),
      devices: registry,
      alerts,
    });
  });

  it("counts an invalid datagram by reason and stops there", () => {
    const bytes = encodeFrame(heartbeat(DEVICE, 1));
    pipeline.handle(Uint8Array.from(bytes, (byte, index) => (index === bytes.length - 1 ? byte ^ 0xff : byte)));
    expect(stats.summary()).toMatchObject({ received: 1, invalid: 1, invalidByReason: { BAD_CHECKSUM: 1 } });
    expect(registry.list()).toEqual([]);
  });

  it("updates stats and registry for a sequence with a gap, a duplicate and a late frame", () => {
    [1, 2, 5, 3, 5, 6].forEach((seq) => pipeline.handle(encodeFrame(telemetry(DEVICE, seq, NOMINAL))));
    expect(stats.summary()).toMatchObject({ received: 6, valid: 6, accepted: 4, lost: 2, late: 1, duplicates: 1 });
    expect(registry.list()).toMatchObject([{ deviceId: DEVICE, lastSeq: 6, lost: 2, late: 1, duplicates: 1 }]);
  });

  it("feeds accepted device states to the alert engine", () => {
    pipeline.handle(encodeFrame(telemetry(DEVICE, 1, { ...NOMINAL, hundredthsC: 8000 })));
    clock.advance(CONFIG.alertDurationMs);
    expect(alerts.active()).toMatchObject([{ deviceId: DEVICE, ruleId: "temperature-critical" }]);
  });
});
