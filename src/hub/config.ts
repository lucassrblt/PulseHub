/** Typed, validated runtime settings of the hub. */
export interface HubConfig {
  readonly hubPort: number;
  readonly httpPort: number;
  readonly snapshotIntervalMs: number;
  readonly offlineAfterMs: number;
  readonly tempWarnC: number;
  readonly tempCritC: number;
  readonly voltageMinMv: number;
  readonly voltageMaxMv: number;
  readonly currentMaxMa: number;
  readonly alertDurationMs: number;
  readonly lossWarnPct: number;
  readonly lossCritPct: number;
  readonly rateWindowMs: number;
  readonly healthWindowMs: number;
  readonly rebootUptimeDropMs: number;
  readonly maxSeqGap: number;
}

/** Environment variables as read from process.env. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

interface IntegerSetting {
  readonly key: string;
  readonly fallback: number;
  readonly min: number;
  readonly max: number;
}

const MIN_PORT = 1;
const MAX_PORT = 65535;
const MIN_DURATION_MS = 1;
const MAX_DURATION_MS = 86_400_000;
const MAX_WINDOW_MS = 60_000;
const MIN_TEMPERATURE_C = -273;
const MAX_TEMPERATURE_C = 1000;
const MIN_INT16_READING = 0;
const MAX_INT16_READING = 32767;
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
const MIN_SEQ_GAP = 1;
const MAX_SEQ_GAP = 2 ** 31 - 1;

const SETTINGS = {
  hubPort: { key: "HUB_PORT", fallback: 9000, min: MIN_PORT, max: MAX_PORT },
  httpPort: { key: "HTTP_PORT", fallback: 8080, min: MIN_PORT, max: MAX_PORT },
  snapshotIntervalMs: { key: "SNAPSHOT_INTERVAL_MS", fallback: 250, min: MIN_DURATION_MS, max: MAX_DURATION_MS },
  offlineAfterMs: { key: "OFFLINE_AFTER_MS", fallback: 2000, min: MIN_DURATION_MS, max: MAX_DURATION_MS },
  tempWarnC: { key: "TEMP_WARN_C", fallback: 60, min: MIN_TEMPERATURE_C, max: MAX_TEMPERATURE_C },
  tempCritC: { key: "TEMP_CRIT_C", fallback: 70, min: MIN_TEMPERATURE_C, max: MAX_TEMPERATURE_C },
  voltageMinMv: { key: "VOLTAGE_MIN_MV", fallback: 22000, min: MIN_INT16_READING, max: MAX_INT16_READING },
  voltageMaxMv: { key: "VOLTAGE_MAX_MV", fallback: 26000, min: MIN_INT16_READING, max: MAX_INT16_READING },
  currentMaxMa: { key: "CURRENT_MAX_MA", fallback: 10000, min: MIN_INT16_READING, max: MAX_INT16_READING },
  alertDurationMs: { key: "ALERT_DURATION_MS", fallback: 3000, min: MIN_DURATION_MS, max: MAX_DURATION_MS },
  lossWarnPct: { key: "LOSS_WARN_PCT", fallback: 1, min: MIN_PERCENT, max: MAX_PERCENT },
  lossCritPct: { key: "LOSS_CRIT_PCT", fallback: 5, min: MIN_PERCENT, max: MAX_PERCENT },
  rateWindowMs: { key: "RATE_WINDOW_MS", fallback: 1000, min: MIN_DURATION_MS, max: MAX_DURATION_MS },
  healthWindowMs: { key: "HEALTH_WINDOW_MS", fallback: 10_000, min: MIN_DURATION_MS, max: MAX_WINDOW_MS },
  rebootUptimeDropMs: { key: "REBOOT_UPTIME_DROP_MS", fallback: 1000, min: MIN_DURATION_MS, max: MAX_DURATION_MS },
  maxSeqGap: { key: "MAX_SEQ_GAP", fallback: 1000, min: MIN_SEQ_GAP, max: MAX_SEQ_GAP },
} as const satisfies Record<keyof HubConfig, IntegerSetting>;

/** Raised at startup when an environment variable holds an invalid value. */
export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

/** Reads the hub settings from the environment, applying defaults and validating every value. */
export function loadConfig(env: EnvSource): HubConfig {
  const config: HubConfig = {
    hubPort: readInteger(env, SETTINGS.hubPort),
    httpPort: readInteger(env, SETTINGS.httpPort),
    snapshotIntervalMs: readInteger(env, SETTINGS.snapshotIntervalMs),
    offlineAfterMs: readInteger(env, SETTINGS.offlineAfterMs),
    tempWarnC: readInteger(env, SETTINGS.tempWarnC),
    tempCritC: readInteger(env, SETTINGS.tempCritC),
    voltageMinMv: readInteger(env, SETTINGS.voltageMinMv),
    voltageMaxMv: readInteger(env, SETTINGS.voltageMaxMv),
    currentMaxMa: readInteger(env, SETTINGS.currentMaxMa),
    alertDurationMs: readInteger(env, SETTINGS.alertDurationMs),
    lossWarnPct: readInteger(env, SETTINGS.lossWarnPct),
    lossCritPct: readInteger(env, SETTINGS.lossCritPct),
    rateWindowMs: readInteger(env, SETTINGS.rateWindowMs),
    healthWindowMs: readInteger(env, SETTINGS.healthWindowMs),
    rebootUptimeDropMs: readInteger(env, SETTINGS.rebootUptimeDropMs),
    maxSeqGap: readInteger(env, SETTINGS.maxSeqGap),
  };
  requireLess(SETTINGS.tempWarnC, config.tempWarnC, SETTINGS.tempCritC, config.tempCritC);
  requireLess(SETTINGS.voltageMinMv, config.voltageMinMv, SETTINGS.voltageMaxMv, config.voltageMaxMv);
  requireLess(SETTINGS.lossWarnPct, config.lossWarnPct, SETTINGS.lossCritPct, config.lossCritPct);
  return Object.freeze(config);
}

function readInteger(env: EnvSource, setting: IntegerSetting): number {
  const raw = env[setting.key];
  if (raw === undefined || raw.trim() === "") {
    return setting.fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < setting.min || value > setting.max) {
    throw new ConfigError(
      `${setting.key}="${raw}" is invalid: expected an integer between ${setting.min} and ${setting.max}`,
    );
  }
  return value;
}

function requireLess(lower: IntegerSetting, lowerValue: number, upper: IntegerSetting, upperValue: number): void {
  if (lowerValue >= upperValue) {
    throw new ConfigError(
      `${lower.key}=${lowerValue} must be lower than ${upper.key}=${upperValue}`,
    );
  }
}
