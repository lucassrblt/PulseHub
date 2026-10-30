import { createSocket, type Socket } from "node:dgram";
import type { DatagramSender } from "./ports.js";

/** Sends datagrams over UDP to a fixed host and port. */
export class UdpSender implements DatagramSender {
  private readonly socket: Socket;

  constructor(
    private readonly host: string,
    private readonly port: number,
    onError: (error: Error) => void,
  ) {
    this.socket = createSocket("udp4");
    this.socket.on("error", onError);
  }

  send(bytes: Uint8Array): void {
    this.socket.send(bytes, this.port, this.host);
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.socket.close(() => resolve()));
  }
}
