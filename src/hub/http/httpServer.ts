import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { Logger } from "../logger.js";
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
    private readonly port: number,
    private readonly routes: HttpRoutes,
    private readonly logger: Logger,
  ) {}

  /** Listens on the port, starts the snapshot stream and resolves with the bound port. */
  start(): Promise<number> {
    const server = createServer((request, response) => this.route(request, response));
    this.server = server;
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.port, () => {
        server.off("error", reject);
        server.on("error", (error) => this.logger.error(`http server error: ${error.message}`));
        this.routes.events.start();
        resolve((server.address() as AddressInfo).port);
      });
    });
  }

  /** Ends the stream clients, stops the stream and closes the server; does nothing when not started. */
  stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) {
      return Promise.resolve();
    }
    this.routes.events.stop();
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
