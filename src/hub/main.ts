import { fileURLToPath } from "node:url";
import { decodeFrame } from "../protocol/index.js";
import { intervalTimer, systemClock } from "../shared/time.js";
import { AlertEngine } from "./alertEngine.js";
import { buildAlertRules } from "./alertRules.js";
import { loadConfig } from "./config.js";
import { DeviceRegistry } from "./deviceRegistry.js";
import { DeviceStatusEvaluator } from "./deviceStatus.js";
import { FleetSummary } from "./fleetSummary.js";
import { HttpServer } from "./http/httpServer.js";
import { SnapshotBroadcaster } from "./http/snapshotBroadcaster.js";
import { StaticFileHandler } from "./http/staticFiles.js";
import { consoleLogger } from "./logger.js";
import { FramePipeline } from "./pipeline.js";
import { ReceptionStats } from "./receptionStats.js";
import { Sequencer } from "./sequencer.js";
import { formatStatusLine } from "./statusLine.js";
import { startAll } from "./startup.js";
import { buildStatusRules } from "./statusRules.js";
import { buildOutOfRangePredicate, thresholdLimits } from "./thresholds.js";
import { UdpReceiver } from "./udpReceiver.js";

const STATUS_LINE_INTERVAL_MS = 2000;
const PUBLIC_DIR = fileURLToPath(new URL("../../public/", import.meta.url));

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const clock = systemClock;
  const stats = new ReceptionStats(clock, config);
  const registry = new DeviceRegistry(clock, buildOutOfRangePredicate(config));
  const alerts = new AlertEngine(clock, buildAlertRules(config), config);
  const pipeline = new FramePipeline({
    decode: decodeFrame,
    stats,
    sequencer: new Sequencer(config),
    devices: registry,
    alerts,
  });
  const summary = new FleetSummary({
    clock,
    startedAtMs: clock.now(),
    reception: stats,
    devices: registry,
    statuses: new DeviceStatusEvaluator(clock, config.offlineAfterMs, buildStatusRules(config)),
    alerts,
    thresholds: thresholdLimits(config),
  });
  const receiver = new UdpReceiver({ host: config.hubHost, port: config.hubPort }, (bytes) => pipeline.handle(bytes), consoleLogger);
  const broadcaster = new SnapshotBroadcaster(summary, intervalTimer, config.snapshotIntervalMs);
  const web = new HttpServer(
    { host: config.hubHost, port: config.httpPort },
    { files: new StaticFileHandler(PUBLIC_DIR), events: broadcaster },
    consoleLogger,
  );

  const [port, httpPort] = await startAll([receiver, web]);
  broadcaster.start();
  consoleLogger.info(`PulseHub hub listening on udp/${port}`);
  consoleLogger.info(`PulseHub dashboard on http://localhost:${httpPort}`);
  const stopStatusLine = intervalTimer.every(STATUS_LINE_INTERVAL_MS, () =>
    consoleLogger.info(formatStatusLine(summary.snapshot())),
  );

  const shutdown = (): void => {
    stopStatusLine();
    broadcaster.stop();
    void Promise.all([receiver.stop(), web.stop()]).then(() => consoleLogger.info("PulseHub hub stopped"));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  consoleLogger.error(`PulseHub hub failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
