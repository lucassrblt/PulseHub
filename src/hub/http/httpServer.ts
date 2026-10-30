import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { Logger } from "../logger.js";
import type { ListenAddress } from "../startup.js";
import type { EventStream } from "./snapshotBroadcaster.js";
import { sendNotFound, type FileServer } from "./staticFiles.js";

const EVENTS_PATH = "/events";
const URL_BASE = "http://localhost";

/** Request handlers the web server routes to. */
export interface HttpRoutes {
  readonly files: FileServer;
  readonly events: EventStream;
}

/** Web server of the dashboard: static files and the live snapshot stream. */
export class HttpServer {
  private server: Server | undefined;

  constructor(
    private readonly address: ListenAddress,
    private readonly routes: HttpRoutes,
    private readonly logger: Logger,
  ) {}

  /** Listens on the address and resolves with the bound port. */
  start(): Promise<number> {
    const server = createServer((request, response) => this.route(request, response));
    this.server = server;
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.address.port, this.address.host, () => {
        server.off("error", reject);
        server.on("error", (error) => this.logger.error(`http server error: ${error.message}`));
        resolve((server.address() as AddressInfo).port);
      });
    });
  }

  /** Closes every connection, including the stream clients, then the server; does nothing when not started. */
  stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }

  private route(request: IncomingMessage, response: ServerResponse): void {
    const { pathname } = new URL(request.url ?? "/", URL_BASE);
    if (request.method !== "GET") {
      sendNotFound(response);
    } else if (pathname === EVENTS_PATH) {
      this.routes.events.connect(response);
    } else {
      void this.routes.files.serve(pathname, response);
    }
  }
}
