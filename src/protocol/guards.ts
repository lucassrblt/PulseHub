import { FRAME_TYPE, METRIC_ID } from "./constants.js";
import type { FrameType, MetricId } from "./types.js";

const FRAME_TYPES: readonly number[] = Object.values(FRAME_TYPE);
const METRIC_IDS: readonly number[] = Object.values(METRIC_ID);

/** Whether the code is a known frame type. */
export function isFrameType(code: number): code is FrameType {
  return FRAME_TYPES.includes(code);
}

/** Whether the id is a known metric. */
export function isMetricId(id: number): id is MetricId {
  return METRIC_IDS.includes(id);
}
