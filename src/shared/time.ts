/** Milliseconds in one second. */
export const MS_PER_SECOND = 1000;

/** Source of the current time in milliseconds, injected so time-based logic is testable. */
export interface Clock {
  now(): number;
}

/** Stops a repeating task. */
export type Cancel = () => void;

/** Runs a task repeatedly at a fixed interval, injected so periodic logic is testable. */
export interface Timer {
  every(intervalMs: number, task: () => void): Cancel;
}

/** Wall clock, in milliseconds since the Unix epoch. */
export const systemClock: Clock = {
  now: () => Date.now(),
};

/** Monotonic clock of the running process, unaffected by system time changes. */
export const monotonicClock: Clock = {
  now: () => performance.now(),
};

/** Timer backed by setInterval. */
export const intervalTimer: Timer = {
  every: (intervalMs, task) => {
    const handle = setInterval(task, intervalMs);
    return () => clearInterval(handle);
  },
};
