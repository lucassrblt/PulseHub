/** Smallest valid UDP or TCP port. */
export const MIN_PORT = 1;

/** Largest valid UDP or TCP port. */
export const MAX_PORT = 0xffff;

const DECIMAL_INTEGER = /^-?\d+$/;

/** Raised when a setting holds an invalid value. */
export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

/** Parses a base-10 integer within [min, max]; returns undefined for any other text, such as "0x10" or "1e3". */
export function parseInteger(raw: string, min: number, max: number): number | undefined {
  if (!DECIMAL_INTEGER.test(raw)) {
    return undefined;
  }
  const value = Number(raw);
  return value >= min && value <= max ? value : undefined;
}
