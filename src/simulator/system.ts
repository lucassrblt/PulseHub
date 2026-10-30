import type { Clock, Random, Timer } from "./ports.js";

/** Monotonic clock of the running process. */
export const systemClock: Clock = {
  now: () => performance.now(),
};

/** Timer backed by setInterval. */
export const intervalTimer: Timer = {
  every: (intervalMs, task) => {
    const handle = setInterval(task, intervalMs);
    return () => clearInterval(handle);
  },
};

/** Non-deterministic random source. */
export const mathRandom: Random = Math.random;
