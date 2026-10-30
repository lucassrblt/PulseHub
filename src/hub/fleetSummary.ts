import type { ActiveAlert, AlertSource } from "./alertEngine.js";
import type { Clock } from "./clock.js";
import type { DeviceSource, DeviceState } from "./deviceRegistry.js";
import type { DeviceStatus, DeviceStatusPolicy } from "./deviceStatus.js";
import type { ReceptionSource, ReceptionSummary } from "./receptionStats.js";

const HOTTEST_COUNT = 5;

/** Device state with its status computed at snapshot time. */
export interface DeviceView extends DeviceState {
  readonly status: DeviceStatus;
}

/** Number of devices per status. */
export interface FleetCounts {
  readonly total: number;
  readonly online: number;
  readonly ok: number;
  readonly warn: number;
  readonly crit: number;
  readonly offline: number;
}

/** Plain serializable view of the whole hub, consumed by the visualization. */
export interface FleetSnapshot {
  readonly generatedAt: number;
  readonly hubUptimeMs: number;
  readonly reception: ReceptionSummary;
  readonly fleet: FleetCounts;
  readonly hottest: readonly DeviceView[];
  readonly devices: readonly DeviceView[];
  readonly alerts: readonly ActiveAlert[];
}

/** Produces fleet snapshots. */
export interface SnapshotProvider {
  snapshot(): FleetSnapshot;
}

/** Collaborators the fleet summary reads from. */
export interface FleetSummaryDeps {
  readonly clock: Clock;
  readonly startedAtMs: number;
  readonly reception: ReceptionSource;
  readonly devices: DeviceSource;
  readonly statuses: DeviceStatusPolicy;
  readonly alerts: AlertSource;
}

/** Assembles reception, device and alert data into one snapshot. */
export class FleetSummary implements SnapshotProvider {
  constructor(private readonly deps: FleetSummaryDeps) {}

  snapshot(): FleetSnapshot {
    const now = this.deps.clock.now();
    const devices = this.deps.devices
      .list()
      .map((device) => ({ ...device, status: this.deps.statuses.statusOf(device) }))
      .sort((left, right) => left.deviceId - right.deviceId);
    return {
      generatedAt: now,
      hubUptimeMs: now - this.deps.startedAtMs,
      reception: this.deps.reception.summary(),
      fleet: countByStatus(devices),
      hottest: hottestOf(devices),
      devices,
      alerts: this.deps.alerts.active(),
    };
  }
}

function countByStatus(devices: readonly DeviceView[]): FleetCounts {
  const countOf = (status: DeviceStatus): number => devices.filter((device) => device.status === status).length;
  const offline = countOf("OFFLINE");
  return {
    total: devices.length,
    online: devices.length - offline,
    ok: countOf("OK"),
    warn: countOf("WARN"),
    crit: countOf("CRIT"),
    offline,
  };
}

function hottestOf(devices: readonly DeviceView[]): DeviceView[] {
  return devices
    .filter((device) => device.status !== "OFFLINE" && device.temperatureC !== null)
    .sort((left, right) => (right.temperatureC ?? 0) - (left.temperatureC ?? 0))
    .slice(0, HOTTEST_COUNT);
}
