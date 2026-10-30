import type { Result } from "./types.js";

/** Builds a successful result. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Builds a failed result. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
