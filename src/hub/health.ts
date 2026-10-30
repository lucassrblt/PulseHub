/** Severity level shared by the reception health and the device statuses. */
export type HealthLevel = "OK" | "WARN" | "CRIT";

const SEVERITY: Readonly<Record<HealthLevel, number>> = { OK: 0, WARN: 1, CRIT: 2 };

/** Most severe level of the list, OK when the list is empty. */
export function worstLevel(levels: readonly HealthLevel[]): HealthLevel {
  return levels.reduce<HealthLevel>(
    (worst, level) => (SEVERITY[level] > SEVERITY[worst] ? level : worst),
    "OK",
  );
}

/** CRIT at or above crit, WARN at or above warn, OK otherwise. */
export function levelFromThresholds(value: number, warn: number, crit: number): HealthLevel {
  if (value >= crit) {
    return "CRIT";
  }
  return value >= warn ? "WARN" : "OK";
}
