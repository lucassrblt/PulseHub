import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/hub/config.js";
import { ConfigError } from "../../src/shared/config.js";

describe("loadConfig", () => {
  it("applies the defaults when the environment is empty", () => {
    expect(loadConfig({})).toEqual({
      hubHost: "0.0.0.0",
      hubPort: 9000,
      httpPort: 8080,
      snapshotIntervalMs: 250,
      offlineAfterMs: 2000,
      tempWarnC: 60,
      tempCritC: 70,
      voltageMinMv: 22000,
      voltageMaxMv: 26000,
      currentMaxMa: 10000,
      alertDurationMs: 3000,
      lossWarnPct: 1,
      lossCritPct: 5,
      rateWindowMs: 1000,
      healthWindowMs: 10000,
      rebootUptimeDropMs: 1000,
      maxSeqGap: 1000,
    });
  });

  it("reads overridden values", () => {
    const config = loadConfig({ HUB_PORT: "9100", OFFLINE_AFTER_MS: "5000" });
    expect(config.hubPort).toBe(9100);
    expect(config.offlineAfterMs).toBe(5000);
  });

  it("treats an empty value as unset", () => {
    expect(loadConfig({ HUB_PORT: "", HUB_HOST: " " })).toMatchObject({ hubPort: 9000, hubHost: "0.0.0.0" });
  });

  it("reads the bind address", () => {
    expect(loadConfig({ HUB_HOST: "127.0.0.1" }).hubHost).toBe("127.0.0.1");
  });

  it("accepts negative temperature thresholds", () => {
    expect(loadConfig({ TEMP_WARN_C: "-20", TEMP_CRIT_C: "-5" })).toMatchObject({ tempWarnC: -20, tempCritC: -5 });
  });

  it("returns a frozen object", () => {
    expect(Object.isFrozen(loadConfig({}))).toBe(true);
  });

  it.each([
    ["HUB_PORT", "abc"],
    ["HUB_PORT", "0"],
    ["HUB_PORT", "70000"],
    ["HUB_PORT", "0x2328"],
    ["HUB_PORT", "1e3"],
    ["HUB_PORT", "+9000"],
    ["SNAPSHOT_INTERVAL_MS", "49"],
    ["RATE_WINDOW_MS", "60001"],
    ["OFFLINE_AFTER_MS", "1.5"],
    ["LOSS_CRIT_PCT", "101"],
    ["HEALTH_WINDOW_MS", "60001"],
    ["MAX_SEQ_GAP", "0"],
    ["MAX_SEQ_GAP", "2147483648"],
  ])("rejects %s=%s", (key, value) => {
    expect(() => loadConfig({ [key]: value })).toThrow(ConfigError);
  });

  it("names the faulty key in the error", () => {
    expect(() => loadConfig({ HTTP_PORT: "x" })).toThrow(/HTTP_PORT="x"/);
  });

  it.each([
    [{ TEMP_WARN_C: "70", TEMP_CRIT_C: "70" }],
    [{ VOLTAGE_MIN_MV: "26000", VOLTAGE_MAX_MV: "22000" }],
    [{ LOSS_WARN_PCT: "6" }],
  ])("rejects inconsistent bounds %o", (env) => {
    expect(() => loadConfig(env)).toThrow(/must be lower than/);
  });
});
