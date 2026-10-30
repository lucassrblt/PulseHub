import type { AlertRule } from "./alertRules.js";
import type { Clock } from "./clock.js";
import type { DeviceState } from "./deviceRegistry.js";

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

interface PendingCondition {
  readonly deviceId: number;
  readonly rule: AlertRule;
  readonly sinceMs: number;
}

/** Raises an alert when a rule holds continuously for the configured duration, clears it when it stops. */
export class AlertEngine implements AlertTracker, AlertSource {
  private readonly conditions = new Map<string, PendingCondition>();

  constructor(
    private readonly clock: Clock,
    private readonly rules: readonly AlertRule[],
    private readonly alertDurationMs: number,
  ) {}

  evaluate(device: DeviceState): void {
    for (const rule of this.rules) {
      const key = `${device.deviceId}:${rule.id}`;
      if (!rule.isTriggered(device)) {
        this.conditions.delete(key);
      } else if (!this.conditions.has(key)) {
        this.conditions.set(key, { deviceId: device.deviceId, rule, sinceMs: this.clock.now() });
      }
    }
  }

  active(): readonly ActiveAlert[] {
    const now = this.clock.now();
    return [...this.conditions.values()]
      .filter((condition) => now - condition.sinceMs >= this.alertDurationMs)
      .map((condition) => ({
        deviceId: condition.deviceId,
        ruleId: condition.rule.id,
        label: condition.rule.label,
        sinceMs: condition.sinceMs,
        durationMs: now - condition.sinceMs,
      }))
      .sort((left, right) => left.deviceId - right.deviceId || left.ruleId.localeCompare(right.ruleId));
  }
}
