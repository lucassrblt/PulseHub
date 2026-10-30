import { describe, expect, it } from "vitest";
import { xorChecksum } from "../../src/protocol/checksum.js";

describe("xorChecksum", () => {
  it("returns 0 for an empty range", () => {
    expect(xorChecksum(new Uint8Array([0xab, 0xcd]), 0)).toBe(0);
  });

  it("returns the byte itself for a single byte", () => {
    expect(xorChecksum(new Uint8Array([0x5a]), 1)).toBe(0x5a);
  });

  it("xors all bytes before end and ignores the rest", () => {
    const bytes = new Uint8Array([0x0f, 0xf0, 0x33, 0xff]);
    expect(xorChecksum(bytes, 3)).toBe(0x0f ^ 0xf0 ^ 0x33);
  });

  it("cancels out identical bytes", () => {
    expect(xorChecksum(new Uint8Array([0x42, 0x42]), 2)).toBe(0);
  });

  it("matches the reference heartbeat checksum", () => {
    const header = new Uint8Array([
      0x50, 0x48, 0x01, 0x02, 0x00, 0x07, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x03, 0xe8, 0x00,
    ]);
    expect(xorChecksum(header, header.length)).toBe(0xf6);
  });

  it("does not read past the end of the buffer", () => {
    expect(xorChecksum(new Uint8Array([0x12]), 10)).toBe(0x12);
  });
});
