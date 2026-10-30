import type { FRAME_TYPE, METRIC_ID } from "./constants.js";

/** Frame type code (TELEMETRY or HEARTBEAT). */
export type FrameType = (typeof FRAME_TYPE)[keyof typeof FRAME_TYPE];

/** Known metric identifier. */
export type MetricId = (typeof METRIC_ID)[keyof typeof METRIC_ID];

/** One measurement of a known metric, value in the metric unit (int16). */
export interface Measurement {
  readonly metricId: MetricId;
  readonly value: number;
}

/** Decoded PulseHub v1 frame. */
export interface Frame {
  readonly type: FrameType;
  readonly deviceId: number;
  readonly seq: number;
  readonly uptimeMs: number;
  readonly measurements: readonly Measurement[];
}

/** Why a datagram was rejected by the decoder. */
export type DecodeErrorReason =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "BAD_MAGIC"
  | "BAD_VERSION"
  | "LENGTH_MISMATCH"
  | "BAD_CHECKSUM"
  | "UNKNOWN_TYPE"
  | "INVALID_DEVICE_ID"
  | "HEARTBEAT_WITH_MEASUREMENTS";

/** Decoder rejection with a machine-readable reason and a human-readable message. */
export interface DecodeError {
  readonly reason: DecodeErrorReason;
  readonly message: string;
}

/** Success or failure value, used instead of exceptions. */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
