import { FIELD_OFFSET, MEASUREMENT_FIELD_OFFSET } from "./constants.js";
import { FRAME_CHECKS, type FrameBytes } from "./checks.js";
import { isMetricId } from "./guards.js";
import { measurementOffset, viewOf } from "./layout.js";
import { err, ok } from "./result.js";
import type { DecodeError, DecodedFrame, FrameType, Measurement, Result } from "./types.js";

/** Decodes one PulseHub v1 datagram. Never throws; unknown metrics are skipped and counted. */
export function decodeFrame(buf: Uint8Array): Result<DecodedFrame, DecodeError> {
  const frame: FrameBytes = { bytes: buf, view: viewOf(buf) };
  const error = firstViolation(frame);
  return error ? err(error) : ok(readFrame(frame.view));
}

function firstViolation(frame: FrameBytes): DecodeError | undefined {
  for (const check of FRAME_CHECKS) {
    const error = check(frame);
    if (error) {
      return error;
    }
  }
  return undefined;
}

function readFrame(view: DataView): DecodedFrame {
  const count = view.getUint8(FIELD_OFFSET.COUNT);
  const measurements = readKnownMeasurements(view, count);
  return {
    type: view.getUint8(FIELD_OFFSET.TYPE) as FrameType,
    deviceId: view.getUint16(FIELD_OFFSET.DEVICE_ID),
    seq: view.getUint32(FIELD_OFFSET.SEQ),
    uptimeMs: view.getUint32(FIELD_OFFSET.UPTIME_MS),
    measurements,
    skippedMeasurements: count - measurements.length,
  };
}

function readKnownMeasurements(view: DataView, count: number): Measurement[] {
  const measurements: Measurement[] = [];
  for (let index = 0; index < count; index++) {
    const offset = measurementOffset(index);
    const metricId = view.getUint8(offset + MEASUREMENT_FIELD_OFFSET.METRIC_ID);
    const value = view.getInt16(offset + MEASUREMENT_FIELD_OFFSET.VALUE);
    if (isMetricId(metricId)) {
      measurements.push({ metricId, value });
    }
  }
  return measurements;
}
