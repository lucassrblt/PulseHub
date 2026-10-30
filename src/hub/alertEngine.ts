import type { AlertRule } from "./alertRules.js";
import type { Clock } from "../shared/time.js";
import type { HubConfig } from "./config.js";
import type { DeviceState } from "./deviceRegistry.js";
import { isOffline } from "./deviceStatus.js";

/** Alert whose condition has held for at least the alert duration. */
export interface ActiveAlert {
  readonly deviceId: number;
  readonly ruleId: string;
  readonly label: string;
  readonly sinceMs: number;
  readonly durationMs: number;
}

/** Write side of the alert engine, fed with every updated device state. */
export interface AlertTracker {
  evaluate(device: DeviceState): void;
}

/** Read side of the alert engine, used by the snapshot. */
export interface AlertSource {
  active(): readonly ActiveAlert[];
}

/** Settings needed by the alert engine. */
export type AlertSettings = Pick<HubConfig, "alertDurationMs" | "offlineAfterMs">;

interface PendingCondition {
  readonly deviceId: number;
  readonly rule: AlertRule;
  readonly sinceMs: number;
  readonly lastSeenMs: number;
}

/**
 * Raises an alert when a rule holds continuously for the configured duration, clears it when it stops.
 * An offline device has no active alert, and its conditions start a fresh duration when it comes back.
 */
export class AlertEngine implements AlertTracker, AlertSource {
  private readonly conditions = new Map<string, PendingCondition>();

  constructor(
    private readonly clock: Clock,
    private readonly rules: readonly AlertRule[],
    private readonly settings: AlertSettings,
  ) {}

  evaluate(device: DeviceState): void {
    const now = this.clock.now();
    for (const rule of this.rules) {
      const key = `${device.deviceId}:${rule.id}`;
      const pending = this.conditions.get(key);
      if (!rule.isTriggered(device)) {
        this.conditions.delete(key);
      } else {
        const sinceMs = pending && !this.isSilent(pending, now) ? pending.sinceMs : now;
        this.conditions.set(key, { deviceId: device.deviceId, rule, sinceMs, lastSeenMs: device.lastSeenMs });
      }
    }
  }

  active(): readonly ActiveAlert[] {
    const now = this.clock.now();
    return [...this.conditions.values()]
      .filter((condition) => !this.isSilent(condition, now) && now - condition.sinceMs >= this.settings.alertDurationMs)
      .map((condition) => ({
        deviceId: condition.deviceId,
        ruleId: condition.rule.id,
        label: condition.rule.label,
        sinceMs: condition.sinceMs,
        durationMs: now - condition.sinceMs,
      }))
      .sort((left, right) => left.deviceId - right.deviceId || left.ruleId.localeCompare(right.ruleId));
  }

  private isSilent(condition: PendingCondition, nowMs: number): boolean {
    return isOffline(condition.lastSeenMs, nowMs, this.settings.offlineAfterMs);
  }
}
