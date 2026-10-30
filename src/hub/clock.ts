/** Source of the current time in milliseconds, injected so time-based logic is testable. */
export interface Clock {
  now(): number;
}

/** Clock backed by the system time. */
export const systemClock: Clock = {
  now: () => Date.now(),
};
