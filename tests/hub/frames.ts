import { FRAME_TYPE, METRIC_ID, type Frame } from "../../src/protocol/index.js";

const FRAME_PERIOD_MS = 100;

/** Telemetry frame with temperature in tenths of a degree, voltage in mV and current in mA. */
export function telemetry(
  deviceId: number,
  seq: number,
  readings: { readonly tenthsC: number; readonly mv: number; readonly ma: number },
  uptimeMs = seq * FRAME_PERIOD_MS,
): Frame {
  return {
    type: FRAME_TYPE.TELEMETRY,
    deviceId,
    seq,
    uptimeMs,
    measurements: [
      { metricId: METRIC_ID.TEMPERATURE, value: readings.tenthsC },
      { metricId: METRIC_ID.VOLTAGE, value: readings.mv },
      { metricId: METRIC_ID.CURRENT, value: readings.ma },
    ],
  };
}

/** Heartbeat frame without measurements. */
export function heartbeat(deviceId: number, seq: number, uptimeMs = seq * FRAME_PERIOD_MS): Frame {
  return { type: FRAME_TYPE.HEARTBEAT, deviceId, seq, uptimeMs, measurements: [] };
}

/** Nominal readings that break no threshold of the default config. */
export const NOMINAL = { tenthsC: 250, mv: 24000, ma: 5000 } as const;
