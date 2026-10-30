import { createSocket, type Socket } from "node:dgram";
import type { Logger } from "./logger.js";
import type { ListenAddress } from "./startup.js";

/** Callback invoked with the bytes of every received datagram. */
export type DatagramHandler = (bytes: Uint8Array) => void;

/** Listens for UDP datagrams and hands each one to the handler without ever crashing the process. */
export class UdpReceiver {
  private socket: Socket | undefined;

  constructor(
    private readonly address: ListenAddress,
    private readonly handler: DatagramHandler,
    private readonly logger: Logger,
  ) {}

  /** Binds the socket to the address and resolves with the bound port. */
  start(): Promise<number> {
    const socket = createSocket("udp4");
    this.socket = socket;
    socket.on("message", (message) => this.dispatch(message));
    return new Promise((resolve, reject) => {
      const failBind = (error: Error): void => {
        this.socket = undefined;
        socket.close();
        reject(error);
      };
      socket.once("error", failBind);
      socket.bind(this.address.port, this.address.host, () => {
        socket.off("error", failBind);
        socket.on("error", (error) => this.logger.error(`udp socket error: ${error.message}`));
        resolve(socket.address().port);
      });
    });
  }

  /** Closes the socket; does nothing when not started. */
  stop(): Promise<void> {
    const socket = this.socket;
    this.socket = undefined;
    return new Promise((resolve) => (socket ? socket.close(() => resolve()) : resolve()));
  }

  private dispatch(message: Uint8Array): void {
    try {
      this.handler(message);
    } catch (error) {
      this.logger.error(`datagram handler failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
