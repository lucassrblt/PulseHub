import type { Clock } from "./clock.js";
import type { DeviceState } from "./deviceRegistry.js";
import { worstLevel, type HealthLevel } from "./health.js";
import type { StatusRule } from "./statusRules.js";

/** Status of a device as shown to the operator. */
export type DeviceStatus = HealthLevel | "OFFLINE";

/** Whether a device last seen at lastSeenMs has been silent for longer than offlineAfterMs. */
export function isOffline(lastSeenMs: number, nowMs: number, offlineAfterMs: number): boolean {
  return nowMs - lastSeenMs > offlineAfterMs;
}

/** Computes the current status of a device. */
export interface DeviceStatusPolicy {
  statusOf(device: DeviceState): DeviceStatus;
}

/** OFFLINE when silent for too long, otherwise the worst level returned by the status rules. */
export class DeviceStatusEvaluator implements DeviceStatusPolicy {
  constructor(
    private readonly clock: Clock,
    private readonly offlineAfterMs: number,
    private readonly rules: readonly StatusRule[],
  ) {}

  statusOf(device: DeviceState): DeviceStatus {
    if (isOffline(device.lastSeenMs, this.clock.now(), this.offlineAfterMs)) {
      return "OFFLINE";
    }
    return worstLevel(this.rules.map((rule) => rule(device)));
  }
}
