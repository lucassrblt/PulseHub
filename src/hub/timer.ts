/** Stops a repeating task. */
export type Cancel = () => void;

/** Runs a task repeatedly at a fixed interval, injected so periodic logic is testable. */
export interface Timer {
  every(intervalMs: number, task: () => void): Cancel;
}

/** Timer backed by setInterval. */
export const intervalTimer: Timer = {
  every: (intervalMs, task) => {
    const handle = setInterval(task, intervalMs);
    return () => clearInterval(handle);
  },
};
