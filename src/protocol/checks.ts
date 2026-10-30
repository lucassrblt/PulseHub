import {
  FIELD_OFFSET,
  FRAME_TYPE,
  MAGIC,
  MAX_FRAME_SIZE,
  MIN_DEVICE_ID,
  MIN_FRAME_SIZE,
  PROTOCOL_VERSION,
} from "./constants.js";
import { xorChecksum } from "./checksum.js";
import { isFrameType } from "./guards.js";
import { checksumOffset, frameLength } from "./layout.js";
import type { DecodeError, DecodeErrorReason } from "./types.js";

/** Raw datagram handed to the validation rules. */
export interface FrameBytes {
  readonly bytes: Uint8Array;
  readonly view: DataView;
}

/** Validation rule returning an error when broken; it may rely on the rules listed before it. */
export type FrameCheck = (frame: FrameBytes) => DecodeError | undefined;

function rejection(reason: DecodeErrorReason, message: string): DecodeError {
  return { reason, message };
}

const checkMinLength: FrameCheck = ({ bytes }) =>
  bytes.length < MIN_FRAME_SIZE
    ? rejection("TOO_SHORT", `expected at least ${MIN_FRAME_SIZE} bytes, got ${bytes.length}`)
    : undefined;

const checkMaxLength: FrameCheck = ({ bytes }) =>
  bytes.length > MAX_FRAME_SIZE
    ? rejection("TOO_LONG", `expected at most ${MAX_FRAME_SIZE} bytes, got ${bytes.length}`)
    : undefined;

const checkMagic: FrameCheck = ({ view }) => {
  const magic = view.getUint16(FIELD_OFFSET.MAGIC);
  return magic !== MAGIC ? rejection("BAD_MAGIC", `unexpected magic 0x${magic.toString(16)}`) : undefined;
};

const checkVersion: FrameCheck = ({ view }) => {
  const version = view.getUint8(FIELD_OFFSET.VERSION);
  return version !== PROTOCOL_VERSION
    ? rejection("BAD_VERSION", `unsupported version ${version}`)
    : undefined;
};

const checkDeclaredLength: FrameCheck = ({ bytes, view }) => {
  const expected = frameLength(view.getUint8(FIELD_OFFSET.COUNT));
  return bytes.length !== expected
    ? rejection("LENGTH_MISMATCH", `count implies ${expected} bytes, got ${bytes.length}`)
    : undefined;
};

const checkChecksum: FrameCheck = ({ bytes, view }) => {
  const offset = checksumOffset(bytes.length);
  const expected = xorChecksum(bytes, offset);
  const actual = view.getUint8(offset);
  return actual !== expected
    ? rejection("BAD_CHECKSUM", `expected checksum ${expected}, got ${actual}`)
    : undefined;
};

const checkType: FrameCheck = ({ view }) => {
  const type = view.getUint8(FIELD_OFFSET.TYPE);
  return isFrameType(type) ? undefined : rejection("UNKNOWN_TYPE", `unknown frame type ${type}`);
};

const checkDeviceId: FrameCheck = ({ view }) => {
  const deviceId = view.getUint16(FIELD_OFFSET.DEVICE_ID);
  return deviceId < MIN_DEVICE_ID
    ? rejection("INVALID_DEVICE_ID", `device id must be at least ${MIN_DEVICE_ID}`)
    : undefined;
};

const checkHeartbeatIsEmpty: FrameCheck = ({ view }) => {
  const isHeartbeat = view.getUint8(FIELD_OFFSET.TYPE) === FRAME_TYPE.HEARTBEAT;
  const count = view.getUint8(FIELD_OFFSET.COUNT);
  return isHeartbeat && count !== 0
    ? rejection("HEARTBEAT_WITH_MEASUREMENTS", `heartbeat carries ${count} measurements`)
    : undefined;
};

/** Validation rules run in order by the decoder; the first broken rule rejects the frame. */
export const FRAME_CHECKS: readonly FrameCheck[] = [
  checkMinLength,
  checkMaxLength,
  checkMagic,
  checkVersion,
  checkDeclaredLength,
  checkChecksum,
  checkType,
  checkDeviceId,
  checkHeartbeatIsEmpty,
];
