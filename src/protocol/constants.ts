/** Two-byte protocol signature, "PH" read as a big-endian uint16. */
export const MAGIC = 0x5048;

/** Only protocol version supported by this implementation. */
export const PROTOCOL_VERSION = 1;

/** Byte offsets of the fixed header fields. */
export const FIELD_OFFSET = {
  MAGIC: 0,
  VERSION: 2,
  TYPE: 3,
  DEVICE_ID: 4,
  SEQ: 6,
  UPTIME_MS: 10,
  COUNT: 14,
  MEASUREMENTS: 15,
} as const;

/** Byte offsets inside a single measurement. */
export const MEASUREMENT_FIELD_OFFSET = {
  METRIC_ID: 0,
  VALUE: 1,
} as const;

/** Size of the fixed header, before the measurements. */
export const HEADER_SIZE = FIELD_OFFSET.MEASUREMENTS;

/** Size of one measurement: metricId uint8 + value int16. */
export const MEASUREMENT_SIZE = 3;

/** Size of the trailing XOR checksum. */
export const CHECKSUM_SIZE = 1;

/** Smallest valid frame: header and checksum without measurements. */
export const MIN_FRAME_SIZE = HEADER_SIZE + CHECKSUM_SIZE;

/** Largest accepted datagram. */
export const MAX_FRAME_SIZE = 512;

/** Number of distinct uint32 values; seq and uptimeMs wrap at this value. */
export const UINT32_RANGE = 2 ** 32;

/** Smallest valid device identifier. */
export const MIN_DEVICE_ID = 1;

/** Frame type codes. */
export const FRAME_TYPE = {
  TELEMETRY: 0x01,
  HEARTBEAT: 0x02,
} as const;

/** Known metric identifiers. */
export const METRIC_ID = {
  TEMPERATURE: 1,
  VOLTAGE: 2,
  CURRENT: 3,
} as const;
