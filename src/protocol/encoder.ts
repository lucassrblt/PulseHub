import { FIELD_OFFSET, MAGIC, MEASUREMENT_FIELD_OFFSET, PROTOCOL_VERSION } from "./constants.js";
import { xorChecksum } from "./checksum.js";
import { checksumOffset, frameLength, measurementOffset, viewOf } from "./layout.js";
import type { Frame } from "./types.js";

/** Serializes a frame to PulseHub v1 bytes and appends its checksum. Values are not validated. */
export function encodeFrame(frame: Frame): Uint8Array {
  const length = frameLength(frame.measurements.length);
  const bytes = new Uint8Array(length);
  const view = viewOf(bytes);

  view.setUint16(FIELD_OFFSET.MAGIC, MAGIC);
  view.setUint8(FIELD_OFFSET.VERSION, PROTOCOL_VERSION);
  view.setUint8(FIELD_OFFSET.TYPE, frame.type);
  view.setUint16(FIELD_OFFSET.DEVICE_ID, frame.deviceId);
  view.setUint32(FIELD_OFFSET.SEQ, frame.seq);
  view.setUint32(FIELD_OFFSET.UPTIME_MS, frame.uptimeMs);
  view.setUint8(FIELD_OFFSET.COUNT, frame.measurements.length);

  frame.measurements.forEach((measurement, index) => {
    const offset = measurementOffset(index);
    view.setUint8(offset + MEASUREMENT_FIELD_OFFSET.METRIC_ID, measurement.metricId);
    view.setInt16(offset + MEASUREMENT_FIELD_OFFSET.VALUE, measurement.value);
  });

  const checksumAt = checksumOffset(length);
  view.setUint8(checksumAt, xorChecksum(bytes, checksumAt));
  return bytes;
}
