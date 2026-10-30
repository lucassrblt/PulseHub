/** XOR of the bytes in [0, end), the PulseHub v1 frame checksum. */
export function xorChecksum(bytes: Uint8Array, end: number): number {
  let checksum = 0;
  for (let index = 0; index < end; index++) {
    checksum ^= bytes[index] ?? 0;
  }
  return checksum;
}
