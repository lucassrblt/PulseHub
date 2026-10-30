import { describe, expect, it } from "vitest";
import { RateMeter } from "../../src/hub/rateMeter.js";
import { FakeClock } from "./fakeClock.js";

const WINDOW_MS = 1000;

describe("RateMeter", () => {
  it("sums weighted events over the window and forgets them afterwards", () => {
    const clock = new FakeClock();
    const meter = new RateMeter(clock, WINDOW_MS);
    meter.record(5);
    clock.advance(WINDOW_MS / 2);
    meter.record();
    expect(meter.total()).toBe(6);
    expect(meter.perSecond()).toBe(6);
    clock.advance(WINDOW_MS / 2);
    expect(meter.total()).toBe(1);
    clock.advance(WINDOW_MS / 2);
    expect(meter.total()).toBe(0);
  });
});
