import type { FleetSnapshot, SnapshotProvider } from "../../../src/hub/fleetSummary.js";
import type { SseClient } from "../../../src/hub/http/snapshotBroadcaster.js";
import type { Cancel, Timer } from "../../../src/shared/time.js";

/** Snapshot of a fresh hub with the given uptime. */
export function emptySnapshot(hubUptimeMs = 0): FleetSnapshot {
  return {
    generatedAt: hubUptimeMs,
    hubUptimeMs,
    reception: {
      received: 0,
      valid: 0,
      invalid: 0,
      invalidByReason: {},
      accepted: 0,
      duplicates: 0,
      late: 0,
      lost: 0,
      resyncs: 0,
      unknownMetrics: 0,
      framesPerSecond: 0,
      lossRatePct: 0,
      invalidRatePct: 0,
      healthWindowMs: 10_000,
      health: "OK",
    },
    thresholds: {
      temperatureWarnC: 60,
      temperatureCritC: 70,
      voltageMinMv: 22_000,
      voltageMaxMv: 26_000,
      currentMaxMa: 10_000,
    },
    fleet: { total: 0, online: 0, ok: 0, warn: 0, crit: 0, offline: 0, outOfRangeFrames: 0, reboots: 0 },
    hottest: [],
    devices: [],
    alerts: [],
  };
}

/** Provider returning a snapshot whose uptime the test can change. */
export class FakeProvider implements SnapshotProvider {
  uptimeMs = 0;

  snapshot(): FleetSnapshot {
    return emptySnapshot(this.uptimeMs);
  }
}

/** Timer whose tasks run only when fired by the test. */
export class FakeTimer implements Timer {
  private readonly tasks = new Set<() => void>();

  every(_intervalMs: number, task: () => void): Cancel {
    this.tasks.add(task);
    return () => this.tasks.delete(task);
  }

  get pending(): number {
    return this.tasks.size;
  }

  fire(): void {
    this.tasks.forEach((task) => task());
  }
}

/** Client recording what the broadcaster writes, closable by the test. */
export class FakeClient implements SseClient {
  readonly chunks: string[] = [];
  statusCode: number | undefined;
  headers: Record<string, string> = {};
  ended = false;
  private onClose: (() => void) | undefined;

  writeHead(statusCode: number, headers: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  write(chunk: string): void {
    this.chunks.push(chunk);
  }

  end(): void {
    this.ended = true;
  }

  once(_event: "close", listener: () => void): void {
    this.onClose = listener;
  }

  close(): void {
    this.onClose?.();
  }
}
