import type { FleetSnapshot, SnapshotProvider } from "../fleetSummary.js";
import type { Cancel, Timer } from "../timer.js";
import { HTTP_STATUS } from "./httpStatus.js";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

/** The part of an HTTP response the broadcaster writes to. */
export interface SseClient {
  writeHead(statusCode: number, headers: Record<string, string>): unknown;
  write(chunk: string): unknown;
  end(): unknown;
  once(event: "close", listener: () => void): unknown;
}

/** Live stream of snapshots that clients can subscribe to. */
export interface EventStream {
  connect(client: SseClient): void;
  start(): void;
  stop(): void;
}

/** Formats a snapshot as one Server-Sent Events message. */
export function toSseMessage(snapshot: FleetSnapshot): string {
  return `data: ${JSON.stringify(snapshot)}\n\n`;
}

/** Sends the current snapshot to every connected client at a fixed interval. */
export class SnapshotBroadcaster implements EventStream {
  private readonly clients = new Set<SseClient>();
  private cancel: Cancel | undefined;

  constructor(
    private readonly provider: SnapshotProvider,
    private readonly timer: Timer,
    private readonly intervalMs: number,
  ) {}

  /** Number of connected clients. */
  get clientCount(): number {
    return this.clients.size;
  }

  connect(client: SseClient): void {
    client.writeHead(HTTP_STATUS.OK, SSE_HEADERS);
    client.write(toSseMessage(this.provider.snapshot()));
    this.clients.add(client);
    client.once("close", () => this.clients.delete(client));
  }

  start(): void {
    this.cancel = this.timer.every(this.intervalMs, () => this.broadcast());
  }

  stop(): void {
    this.cancel?.();
    this.cancel = undefined;
    this.clients.forEach((client) => client.end());
    this.clients.clear();
  }

  private broadcast(): void {
    if (this.clients.size === 0) {
      return;
    }
    const message = toSseMessage(this.provider.snapshot());
    this.clients.forEach((client) => client.write(message));
  }
}
