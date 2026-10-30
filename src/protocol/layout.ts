import { CHECKSUM_SIZE, FIELD_OFFSET, MEASUREMENT_SIZE, MIN_FRAME_SIZE } from "./constants.js";

/** Total frame length in bytes for a given measurement count. */
export function frameLength(count: number): number {
  return MIN_FRAME_SIZE + MEASUREMENT_SIZE * count;
}

/** Byte offset of the measurement at the given index. */
export function measurementOffset(index: number): number {
  return FIELD_OFFSET.MEASUREMENTS + MEASUREMENT_SIZE * index;
}

/** Byte offset of the checksum in a frame of the given length. */
export function checksumOffset(length: number): number {
  return length - CHECKSUM_SIZE;
}

/** Big-endian DataView over exactly the bytes of the given array. */
export function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
