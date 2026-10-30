import { parseCli, usage, type SimulatorConfig } from "./config.js";
import { createDevices } from "./device.js";
import { AnomalyFault } from "./faults/anomaly.js";
import { ChecksumFault } from "./faults/checksum.js";
import { DuplicateFault } from "./faults/duplicate.js";
import { HotFault } from "./faults/hot.js";
import { RebootFault } from "./faults/reboot.js";
import { ReorderFault } from "./faults/reorder.js";
import type { FaultStage } from "./faults/stage.js";
import { StopFault, pickStoppedIds } from "./faults/stop.js";
import { MS_PER_SECOND } from "./limits.js";
import type { Clock, Random } from "./ports.js";
import { Simulator } from "./simulator.js";
import { StatsReporter } from "./stats.js";
import { intervalTimer, mathRandom, systemClock } from "./system.js";
import { UdpSender } from "./udp-sender.js";
import { NOMINAL_WALKS } from "./walk.js";

const EXIT_INVALID_ARGS = 2;

function stoppedIds(config: SimulatorConfig, random: Random): number[] {
  return config.stopIds.length > 0
    ? [...config.stopIds]
    : pickStoppedIds(config.faultStop, config.devices, random);
}

function buildStages(
  config: SimulatorConfig,
  ids: readonly number[],
  random: Random,
  clock: Clock,
): FaultStage[] {
  return [
    new StopFault(new Set(ids), clock.now() + config.stopAfterMs, clock),
    new HotFault(new Set(config.hotIds), clock.now() + config.hotAfterMs, clock),
    new AnomalyFault(config.faultAnomaly, random),
    new ChecksumFault(config.faultChecksum, random),
    new ReorderFault(config.faultReorder, random),
    new DuplicateFault(config.faultDup, random),
  ];
}

function summary(config: SimulatorConfig, ids: readonly number[]): string {
  const rate = Math.round(config.devices * config.hz);
  const faults = [
    `checksum=${config.faultChecksum}`,
    `dup=${config.faultDup}`,
    `reorder=${config.faultReorder}`,
    `anomaly=${config.faultAnomaly}`,
    `reboot=${config.faultReboot}`,
    `stop=[${ids.join(",")}] after ${config.stopAfterMs}ms`,
  ];
  return (
    `simulator: ${config.devices} devices x ${config.hz} Hz = ${rate} frames/s to ` +
    `${config.host}:${config.port}, seq from ${config.seqStart} | faults ${faults.join(" ")}`
  );
}

function run(config: SimulatorConfig): void {
  const clock = systemClock;
  const random = mathRandom;
  const ids = stoppedIds(config, random);
  const stages = buildStages(config, ids, random, clock);
  const deviceFaults = [new RebootFault(config.faultReboot, random)];
  const deviceOptions = {
    heartbeatEvery: config.heartbeatEvery,
    seqStart: config.seqStart,
    walks: NOMINAL_WALKS,
  };
  const sender = new UdpSender(config.host, config.port, (error) =>
    console.error(`udp error: ${error.message}`),
  );
  const simulator = new Simulator({
    devices: createDevices(config.devices, deviceOptions, random, clock.now()),
    deviceFaults,
    stages,
    sender,
    clock,
    timer: intervalTimer,
    periodMs: MS_PER_SECOND / config.hz,
    tickMs: config.tickMs,
  });
  const stats = new StatsReporter(() => simulator.framesSent, [...stages, ...deviceFaults], clock);

  console.log(summary(config, ids));
  simulator.start();
  const stopStats = intervalTimer.every(config.statsIntervalMs, () => console.log(stats.rateLine()));

  process.once("SIGINT", () => {
    simulator.stop();
    stopStats();
    void sender.close().then(() => console.log(stats.totalsLine()));
  });
}

const parsed = parseCli(process.argv.slice(2), process.env);
if (!parsed.ok) {
  console.error(`${parsed.error}\nRun "npm run sim -- --help" for usage.`);
  process.exit(EXIT_INVALID_ARGS);
} else if (parsed.value.kind === "help") {
  console.log(usage());
} else {
  run(parsed.value.config);
}
