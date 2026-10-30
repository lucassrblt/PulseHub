/** Number of distinct uint32 values; seq and uptime wrap at this value. */
export const UINT32_RANGE = 2 ** 32;

/** Largest device identifier that fits in the uint16 deviceId field. */
export const MAX_DEVICE_ID = 0xffff;

/** Largest valid UDP port. */
export const MAX_PORT = 0xffff;

/** Milliseconds in one second. */
export const MS_PER_SECOND = 1000;

/** Highest total send rate (devices x hz) the simulator accepts, in frames per second. */
export const MAX_TOTAL_FPS = 50_000;
