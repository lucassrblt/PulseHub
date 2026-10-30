/** Source of uniformly distributed numbers in [0, 1). */
export type Random = () => number;

/** Sends datagrams to the hub. */
export interface DatagramSender {
  send(bytes: Uint8Array): void;
  close(): Promise<void>;
}
