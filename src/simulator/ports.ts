/** Source of uniformly distributed numbers in [0, 1). */
export type Random = () => number;

/** Current time in milliseconds. */
export interface Clock {
  now(): number;
}

/** Stops a repeating task. */
export type Cancel = () => void;

/** Runs a task repeatedly at a fixed interval. */
export interface Timer {
  every(intervalMs: number, task: () => void): Cancel;
}

/** Sends datagrams to the hub. */
export interface DatagramSender {
  send(bytes: Uint8Array): void;
  close(): Promise<void>;
}
