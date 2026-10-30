import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { join } from "node:path";
import { HTTP_STATUS } from "./httpStatus.js";

interface StaticFile {
  readonly fileName: string;
  readonly contentType: string;
}

const INDEX: StaticFile = { fileName: "index.html", contentType: "text/html; charset=utf-8" };
const FONTS_DIR = "fonts";
const FONT_FILE_NAMES = [
  "barlow-latin-400-normal.woff2",
  "barlow-latin-600-normal.woff2",
  "barlow-semi-condensed-latin-600-normal.woff2",
];

function fontRoutes(): Record<string, StaticFile> {
  return Object.fromEntries(
    FONT_FILE_NAMES.map((name) => [
      `/${FONTS_DIR}/${name}`,
      { fileName: join(FONTS_DIR, name), contentType: "font/woff2" },
    ]),
  );
}

const PUBLIC_FILES: Readonly<Record<string, StaticFile>> = {
  "/": INDEX,
  "/index.html": INDEX,
  "/app.js": { fileName: "app.js", contentType: "text/javascript; charset=utf-8" },
  "/style.css": { fileName: "style.css", contentType: "text/css; charset=utf-8" },
  ...fontRoutes(),
};

/** Serves a request path to a response. */
export interface FileServer {
  serve(pathname: string, response: ServerResponse): Promise<void>;
}

/** Sends a plain 404 response. */
export function sendNotFound(response: ServerResponse): void {
  response.writeHead(HTTP_STATUS.NOT_FOUND, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

/** Serves only the whitelisted dashboard files from the public directory, 404 for anything else. */
export class StaticFileHandler implements FileServer {
  constructor(private readonly publicDir: string) {}

  async serve(pathname: string, response: ServerResponse): Promise<void> {
    const file = Object.hasOwn(PUBLIC_FILES, pathname) ? PUBLIC_FILES[pathname] : undefined;
    if (!file) {
      sendNotFound(response);
      return;
    }
    try {
      const content = await readFile(join(this.publicDir, file.fileName));
      response.writeHead(HTTP_STATUS.OK, { "Content-Type": file.contentType });
      response.end(content);
    } catch {
      sendNotFound(response);
    }
  }
}
