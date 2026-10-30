import type { FleetSnapshot } from "./fleetSummary.js";

const RATE_DECIMALS = 1;

/** One compact console line summarizing a snapshot. */
export function formatStatusLine(snapshot: FleetSnapshot): string {
  const { reception, fleet } = snapshot;
  return [
    `fps=${reception.framesPerSecond.toFixed(RATE_DECIMALS)}`,
    `accepted=${reception.accepted}`,
    `invalid=${reception.invalid}`,
    `duplicates=${reception.duplicates}`,
    `late=${reception.late}`,
    `lost=${reception.lost}`,
    `loss=${reception.lossRatePct.toFixed(RATE_DECIMALS)}%`,
    `health=${reception.health}`,
    `online=${fleet.online}/${fleet.total}`,
    `alerts=${snapshot.alerts.length}`,
  ].join(" ");
}
