import { describe, expect, it } from "vitest";
import { parseCli, usage, type SimulatorConfig } from "../../src/simulator/config.js";

function configOf(argv: string[], env: Record<string, string> = {}): SimulatorConfig {
  const parsed = parseCli(argv, env);
  if (!parsed.ok || parsed.value.kind !== "run") {
    throw new Error("expected a run command");
  }
  return parsed.value.config;
}

function errorOf(argv: string[], env: Record<string, string> = {}): string {
  const parsed = parseCli(argv, env);
  return parsed.ok ? "" : parsed.error;
}

describe("parseCli", () => {
  it("uses the defaults when nothing is given", () => {
    expect(configOf([])).toMatchObject({
      devices: 50,
      hz: 20,
      host: "127.0.0.1",
      port: 9000,
      heartbeatEvery: 20,
      seqStart: 0,
      faultChecksum: 0,
      faultStop: 0,
      stopIds: [],
      stopAfterMs: 10000,
    });
  });

  it("reads flags", () => {
    const config = configOf(["--devices", "3", "--hz", "2.5", "--fault-dup", "0.1", "--stop-ids", "1,3"]);
    expect(config).toMatchObject({ devices: 3, hz: 2.5, faultDup: 0.1, stopIds: [1, 3] });
  });

  it("reads env variables and lets flags override them", () => {
    const env = { SIM_HOST: "10.0.0.2", SIM_PORT: "9100" };
    expect(configOf([], env)).toMatchObject({ host: "10.0.0.2", port: 9100 });
    expect(configOf(["--port", "9200"], env).port).toBe(9200);
  });

  it("returns help when asked", () => {
    const parsed = parseCli(["--help"], {});
    expect(parsed.ok && parsed.value.kind).toBe("help");
    expect(usage()).toContain("--fault-checksum");
  });

  it.each([
    [["--devices", "0"], "--devices"],
    [["--devices", "70000"], "--devices"],
    [["--devices", "abc"], "--devices"],
    [["--hz", "0"], "--hz"],
    [["--fault-checksum", "1.5"], "--fault-checksum"],
    [["--seq-start", "4294967296"], "--seq-start"],
    [["--devices", "5", "--fault-stop", "6"], "--fault-stop"],
    [["--devices", "5", "--stop-ids", "2,9"], "--stop-ids"],
    [["--unknown", "1"], "unknown"],
  ])("rejects %j", (argv, mention) => {
    expect(errorOf(argv)).toContain(mention);
  });

  it("names the env variable when its value is invalid", () => {
    expect(errorOf([], { SIM_PORT: "99999" })).toContain("SIM_PORT");
  });
});
