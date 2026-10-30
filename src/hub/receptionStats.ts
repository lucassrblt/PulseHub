import type { DecodeErrorReason } from "../protocol/index.js";
import type { Clock } from "./clock.js";
import type { HubConfig } from "./config.js";
import { levelFromThresholds, worstLevel, type HealthLevel } from "./health.js";
import { RateMeter } from "./rateMeter.js";
import type { SequenceVerdict } from "./sequencer.js";

const PERCENT = 100;

/** Reception counters and derived rates exposed to the snapshot. */
export interface ReceptionSummary {
  readonly received: number;
  readonly valid: number;
  readonly invalid: number;
  readonly invalidByReason: Readonly<Partial<Record<DecodeErrorReason, number>>>;
  readonly accepted: number;
  readonly duplicates: number;
  readonly late: number;
  readonly lost: number;
  readonly resyncs: number;
  readonly framesPerSecond: number;
  readonly lossRatePct: number;
  readonly invalidRatePct: number;
  readonly health: HealthLevel;
}

/** Write side of the reception statistics, used by the frame pipeline. */
export interface ReceptionRecorder {
  recordReceived(): void;
  recordInvalid(reason: DecodeErrorReason): void;
  recordVerdict(verdict: SequenceVerdict): void;
}

/** Read side of the reception statistics, used by the snapshot. */
export interface ReceptionSource {
  summary(): ReceptionSummary;
}

/** Settings needed by the reception statistics. */
export type ReceptionSettings = Pick<HubConfig, "rateWindowMs" | "lossWarnPct" | "lossCritPct">;

/** Counts received, invalid, accepted, duplicate, late and lost frames and resyncs, and derives the rates. */
export class ReceptionStats implements ReceptionRecorder, ReceptionSource {
  private readonly rate: RateMeter;
  private readonly invalidByReason: Partial<Record<DecodeErrorReason, number>> = {};
  private received = 0;
  private invalid = 0;
  private accepted = 0;
  private duplicates = 0;
  private late = 0;
  private lost = 0;
  private resyncs = 0;

  constructor(
    clock: Clock,
    private readonly settings: ReceptionSettings,
  ) {
    this.rate = new RateMeter(clock, settings.rateWindowMs);
  }

  recordReceived(): void {
    this.received++;
    this.rate.record();
  }

  recordInvalid(reason: DecodeErrorReason): void {
    this.invalid++;
    this.invalidByReason[reason] = (this.invalidByReason[reason] ?? 0) + 1;
  }

  recordVerdict(verdict: SequenceVerdict): void {
    if (verdict.kind === "accepted") {
      this.accepted++;
      this.lost += verdict.lost;
      this.resyncs += verdict.resynced ? 1 : 0;
    } else if (verdict.kind === "duplicate") {
      this.duplicates++;
    } else {
      this.late++;
    }
  }

  summary(): ReceptionSummary {
    const lossRatePct = percentage(this.lost, this.accepted + this.lost);
    const invalidRatePct = percentage(this.invalid, this.received);
    return {
      received: this.received,
      valid: this.received - this.invalid,
      invalid: this.invalid,
      invalidByReason: { ...this.invalidByReason },
      accepted: this.accepted,
      duplicates: this.duplicates,
      late: this.late,
      lost: this.lost,
      resyncs: this.resyncs,
      framesPerSecond: this.rate.perSecond(),
      lossRatePct,
      invalidRatePct,
      health: worstLevel([this.levelOf(lossRatePct), this.levelOf(invalidRatePct)]),
    };
  }

  private levelOf(ratePct: number): HealthLevel {
    return levelFromThresholds(ratePct, this.settings.lossWarnPct, this.settings.lossCritPct);
  }
}

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : (part / total) * PERCENT;
}
