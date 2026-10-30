import { describe, expect, it } from "vitest";
import { METRIC_ID } from "../../src/protocol/index.js";
import { readingsOf } from "../../src/hub/readings.js";

describe("readingsOf", () => {
  it("decodes temperature from hundredths of a degree as in the protocol example", () => {
    expect(readingsOf([{ metricId: METRIC_ID.TEMPERATURE, value: 4250 }])).toEqual({ temperatureC: 42.5 });
  });

  it("keeps voltage in mV and current in mA", () => {
    const readings = readingsOf([
      { metricId: METRIC_ID.VOLTAGE, value: 24000 },
      { metricId: METRIC_ID.CURRENT, value: 3000 },
    ]);
    expect(readings).toEqual({ voltageMv: 24000, currentMa: 3000 });
  });
});
