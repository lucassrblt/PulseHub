import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  FIELD_OFFSET,
  FRAME_TYPE,
  MAX_FRAME_SIZE,
  MEASUREMENT_SIZE,
  METRIC_ID,
} from "../../src/protocol/constants.js";
import { decodeFrame } from "../../src/protocol/decoder.js";
import { encodeFrame } from "../../src/protocol/encoder.js";
import type { DecodeErrorReason, Frame } from "../../src/protocol/types.js";
import {
  REFERENCE_HEARTBEAT_BYTES,
  REFERENCE_HEARTBEAT_FRAME,
  patchByte,
  withValidChecksum,
} from "./fixtures.js";

const INT16_MAX = 32767;
const INT16_MIN = -32768;
const UNKNOWN_METRIC_ID = 99;
const FUZZ_ITERATIONS = 2000;

const TELEMETRY_FRAME: Frame = {
  type: FRAME_TYPE.TELEMETRY,
  deviceId: 65535,
  seq: 4294967295,
  uptimeMs: 123456789,
  measurements: [
    { metricId: METRIC_ID.TEMPERATURE, value: -500 },
    { metricId: METRIC_ID.VOLTAGE, value: INT16_MAX },
    { metricId: METRIC_ID.CURRENT, value: INT16_MIN },
  ],
};

function expectRejected(bytes: Uint8Array, reason: DecodeErrorReason): void {
  const result = decodeFrame(bytes);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.reason).toBe(reason);
  }
}

describe("decodeFrame", () => {
  it("decodes the reference heartbeat from the specification", () => {
    expect(decodeFrame(REFERENCE_HEARTBEAT_BYTES)).toEqual({
      ok: true,
      value: REFERENCE_HEARTBEAT_FRAME,
    });
  });

  it("round-trips a telemetry frame with negative and extreme int16 values", () => {
    expect(decodeFrame(encodeFrame(TELEMETRY_FRAME))).toEqual({ ok: true, value: TELEMETRY_FRAME });
  });

  it("decodes a Buffer that is a slice of a larger allocation", () => {
    const padded = Buffer.concat([Buffer.from([0xaa, 0xbb, 0xcc]), REFERENCE_HEARTBEAT_BYTES]);
    expect(decodeFrame(padded.subarray(3))).toEqual({ ok: true, value: REFERENCE_HEARTBEAT_FRAME });
  });

  it("skips measurements with an unknown metric id and keeps the frame", () => {
    const bytes = patchByte(encodeFrame(TELEMETRY_FRAME), FIELD_OFFSET.MEASUREMENTS, UNKNOWN_METRIC_ID);
    expect(decodeFrame(bytes)).toEqual({
      ok: true,
      value: { ...TELEMETRY_FRAME, measurements: TELEMETRY_FRAME.measurements.slice(1) },
    });
  });

  describe("rejections", () => {
    it("rejects an empty buffer as TOO_SHORT", () => {
      expectRejected(new Uint8Array(0), "TOO_SHORT");
    });

    it("rejects a truncated frame as TOO_SHORT", () => {
      expectRejected(REFERENCE_HEARTBEAT_BYTES.subarray(0, -1), "TOO_SHORT");
    });

    it("rejects a datagram larger than the maximum as TOO_LONG", () => {
      const bytes = new Uint8Array(MAX_FRAME_SIZE + 1);
      bytes.set(REFERENCE_HEARTBEAT_BYTES);
      expectRejected(bytes, "TOO_LONG");
    });

    it("rejects a wrong magic as BAD_MAGIC", () => {
      expectRejected(patchByte(REFERENCE_HEARTBEAT_BYTES, FIELD_OFFSET.MAGIC, 0x51), "BAD_MAGIC");
    });

    it("rejects an unsupported version as BAD_VERSION", () => {
      expectRejected(patchByte(REFERENCE_HEARTBEAT_BYTES, FIELD_OFFSET.VERSION, 2), "BAD_VERSION");
    });

    it("rejects a count that does not match the datagram length as LENGTH_MISMATCH", () => {
      expectRejected(patchByte(encodeFrame(TELEMETRY_FRAME), FIELD_OFFSET.COUNT, 2), "LENGTH_MISMATCH");
    });

    it("rejects trailing bytes after the checksum as LENGTH_MISMATCH", () => {
      const bytes = new Uint8Array(REFERENCE_HEARTBEAT_BYTES.length + MEASUREMENT_SIZE);
      bytes.set(REFERENCE_HEARTBEAT_BYTES);
      expectRejected(withValidChecksum(bytes), "LENGTH_MISMATCH");
    });

    it("rejects a corrupted byte as BAD_CHECKSUM", () => {
      const bytes = Uint8Array.from(REFERENCE_HEARTBEAT_BYTES);
      bytes[FIELD_OFFSET.SEQ] = 0xff;
      expectRejected(bytes, "BAD_CHECKSUM");
    });

    it("rejects an unknown frame type as UNKNOWN_TYPE", () => {
      expectRejected(patchByte(REFERENCE_HEARTBEAT_BYTES, FIELD_OFFSET.TYPE, 0x03), "UNKNOWN_TYPE");
    });

    it("rejects device id 0 as INVALID_DEVICE_ID", () => {
      expectRejected(
        encodeFrame({ ...REFERENCE_HEARTBEAT_FRAME, deviceId: 0 }),
        "INVALID_DEVICE_ID",
      );
    });

    it("rejects a heartbeat carrying measurements as HEARTBEAT_WITH_MEASUREMENTS", () => {
      expectRejected(
        encodeFrame({ ...TELEMETRY_FRAME, type: FRAME_TYPE.HEARTBEAT }),
        "HEARTBEAT_WITH_MEASUREMENTS",
      );
    });
  });

  describe("robustness", () => {
    it("never throws on random garbage of any length", () => {
      for (let iteration = 0; iteration < FUZZ_ITERATIONS; iteration++) {
        const garbage = randomBytes(iteration % (MAX_FRAME_SIZE + MEASUREMENT_SIZE));
        expect(() => decodeFrame(garbage)).not.toThrow();
      }
    });

    it("never throws on random bytes behind a valid header prefix", () => {
      const prefix = REFERENCE_HEARTBEAT_BYTES.subarray(0, FIELD_OFFSET.DEVICE_ID);
      for (let iteration = 0; iteration < FUZZ_ITERATIONS; iteration++) {
        const tail = randomBytes(iteration % MAX_FRAME_SIZE);
        expect(() => decodeFrame(Buffer.concat([prefix, tail]))).not.toThrow();
      }
    });
  });
});
