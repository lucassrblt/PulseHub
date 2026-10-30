import { describe, expect, it } from "vitest";
import { FRAME_TYPE, METRIC_ID } from "../../src/protocol/constants.js";
import { encodeFrame } from "../../src/protocol/encoder.js";
import { xorChecksum } from "../../src/protocol/checksum.js";
import { REFERENCE_HEARTBEAT_BYTES, REFERENCE_HEARTBEAT_FRAME } from "./fixtures.js";

describe("encodeFrame", () => {
  it("encodes the reference heartbeat to the exact specification bytes", () => {
    expect(encodeFrame(REFERENCE_HEARTBEAT_FRAME)).toEqual(REFERENCE_HEARTBEAT_BYTES);
  });

  it("writes measurements big-endian with a two's complement value", () => {
    const bytes = encodeFrame({
      type: FRAME_TYPE.TELEMETRY,
      deviceId: 1,
      seq: 0,
      uptimeMs: 0,
      measurements: [{ metricId: METRIC_ID.TEMPERATURE, value: -500 }],
    });

    expect(bytes.length).toBe(19);
    expect(bytes[14]).toBe(1);
    expect([...bytes.slice(15, 18)]).toEqual([0x01, 0xfe, 0x0c]);
    expect(bytes[18]).toBe(xorChecksum(bytes, 18));
  });
});
