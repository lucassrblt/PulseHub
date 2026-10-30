import { xorChecksum } from "../../src/protocol/checksum.js";
import { FRAME_TYPE } from "../../src/protocol/constants.js";
import type { Frame } from "../../src/protocol/types.js";

/** Reference heartbeat from the PulseHub v1 specification. */
export const REFERENCE_HEARTBEAT_BYTES = new Uint8Array([
  0x50, 0x48, 0x01, 0x02, 0x00, 0x07, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x03, 0xe8, 0x00, 0xf6,
]);

/** Decoded form of the reference heartbeat. */
export const REFERENCE_HEARTBEAT_FRAME: Frame = {
  type: FRAME_TYPE.HEARTBEAT,
  deviceId: 7,
  seq: 1,
  uptimeMs: 1000,
  measurements: [],
};

/** Returns a copy with the byte at offset replaced and the trailing checksum recomputed. */
export function patchByte(bytes: Uint8Array, offset: number, value: number): Uint8Array {
  const copy = Uint8Array.from(bytes);
  copy[offset] = value;
  return withValidChecksum(copy);
}

/** Recomputes the trailing checksum in place and returns the same array. */
export function withValidChecksum(bytes: Uint8Array): Uint8Array {
  const checksumAt = bytes.length - 1;
  bytes[checksumAt] = xorChecksum(bytes, checksumAt);
  return bytes;
}
