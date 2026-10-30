import { describe, expect, it } from "vitest";
import { parseInteger } from "../../src/shared/config.js";

describe("parseInteger", () => {
  it.each([
    ["42", 42],
    ["-7", -7],
    ["0", 0],
  ])("parses %s", (raw, expected) => {
    expect(parseInteger(raw, -100, 100)).toBe(expected);
  });

  it.each(["0x10", "1e1", "1.5", " 5", "5 ", "+5", "", "abc", "-"])("rejects %j", (raw) => {
    expect(parseInteger(raw, -100, 100)).toBeUndefined();
  });

  it("rejects values outside the range", () => {
    expect(parseInteger("101", -100, 100)).toBeUndefined();
    expect(parseInteger("-101", -100, 100)).toBeUndefined();
  });
});
