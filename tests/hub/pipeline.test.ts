import { beforeEach, describe, expect, it } from "vitest";
import { FIELD_OFFSET, decodeFrame, encodeFrame, xorChecksum } from "../../src/protocol/index.js";
import { AlertEngine } from "../../src/hub/alertEngine.js";
import { buildAlertRules } from "../../src/hub/alertRules.js";
import { loadConfig } from "../../src/hub/config.js";
import { DeviceRegistry } from "../../src/hub/deviceRegistry.js";
import { FramePipeline } from "../../src/hub/pipeline.js";
import { ReceptionStats } from "../../src/hub/receptionStats.js";
import { Sequencer } from "../../src/hub/sequencer.js";
import { buildOutOfRangePredicate } from "../../src/hub/thresholds.js";
import { FakeClock } from "./fakeClock.js";
import { NOMINAL, heartbeat, telemetry } from "./frames.js";

const CONFIG = loadConfig({});
const DEVICE = 4;
const SECOND = 1000;
const UNKNOWN_METRIC_ID = 99;

describe("FramePipeline", () => {
  let clock: FakeClock;
  let stats: ReceptionStats;
  let registry: DeviceRegistry;
  let alerts: AlertEngine;
  let pipeline: FramePipeline;

  beforeEach(() => {
    clock = new FakeClock();
    stats = new ReceptionStats(clock, CONFIG);
    registry = new DeviceRegistry(clock, buildOutOfRangePredicate(CONFIG));
    alerts = new AlertEngine(clock, buildAlertRules(CONFIG), CONFIG);
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

  it("counts the measurements skipped for an unknown metric id", () => {
    const bytes = encodeFrame(telemetry(DEVICE, 1, NOMINAL));
    bytes[FIELD_OFFSET.MEASUREMENTS] = UNKNOWN_METRIC_ID;
    bytes[bytes.length - 1] = xorChecksum(bytes, bytes.length - 1);
    pipeline.handle(bytes);
    expect(stats.summary()).toMatchObject({ accepted: 1, unknownMetrics: 1 });
  });

  it("counts accepted telemetry frames breaking a threshold per device", () => {
    pipeline.handle(encodeFrame(telemetry(DEVICE, 1, NOMINAL)));
    pipeline.handle(encodeFrame(telemetry(DEVICE, 2, { ...NOMINAL, ma: 12000 })));
    pipeline.handle(encodeFrame(telemetry(DEVICE, 2, { ...NOMINAL, ma: 12000 })));
    pipeline.handle(encodeFrame(heartbeat(DEVICE, 3)));
    expect(registry.list()).toMatchObject([{ outOfRange: 1, duplicates: 1 }]);
  });

  function sendHotFrames(seqs: readonly number[]): void {
    seqs.forEach((seq) => {
      pipeline.handle(encodeFrame(telemetry(DEVICE, seq, { ...NOMINAL, hundredthsC: 8000 })));
      clock.advance(SECOND);
    });
  }

  it("feeds accepted device states to the alert engine", () => {
    sendHotFrames([1, 2, 3, 4]);
    expect(alerts.active()).toMatchObject([{ deviceId: DEVICE, ruleId: "temperature-critical" }]);
  });

  it("never turns a one-frame anomaly followed by silence into an active alert", () => {
    sendHotFrames([1]);
    clock.advance(CONFIG.alertDurationMs);
    expect(alerts.active()).toEqual([]);
  });
});
