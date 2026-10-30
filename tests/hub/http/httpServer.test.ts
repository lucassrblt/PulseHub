import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpServer } from "../../../src/hub/http/httpServer.js";
import { SnapshotBroadcaster } from "../../../src/hub/http/snapshotBroadcaster.js";
import { StaticFileHandler } from "../../../src/hub/http/staticFiles.js";
import { FakeProvider, FakeTimer, emptySnapshot } from "./fakes.js";

const LOOPBACK = "127.0.0.1";
const ANY_FREE_ADDRESS = { host: LOOPBACK, port: 0 };
const INTERVAL_MS = 250;
const INDEX_HTML = "<!doctype html><title>PulseHub</title>";
const SSE_PREFIX = "data: ";

describe("HttpServer", () => {
  let publicDir: string;
  let server: HttpServer;
  let baseUrl: string;

  beforeEach(async () => {
    publicDir = await mkdtemp(join(tmpdir(), "pulsehub-public-"));
    await writeFile(join(publicDir, "index.html"), INDEX_HTML);
    await writeFile(join(publicDir, "secret.txt"), "secret");
    const events = new SnapshotBroadcaster(new FakeProvider(), new FakeTimer(), INTERVAL_MS);
    server = new HttpServer(
      ANY_FREE_ADDRESS,
      { files: new StaticFileHandler(publicDir), events },
      { info: vi.fn(), error: vi.fn() },
    );
    baseUrl = `http://${LOOPBACK}:${await server.start()}`;
  });

  afterEach(async () => {
    await server.stop();
    await rm(publicDir, { recursive: true, force: true });
  });

  it("serves the dashboard page on /", async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toBe(INDEX_HTML);
  });

  it.each(["/unknown", "/secret.txt", "/..%2Fsecret.txt", "/app.js"])("returns 404 for %s", async (path) => {
    const response = await fetch(`${baseUrl}${path}`);
    expect(response.status).toBe(404);
  });

  it("sends the current snapshot as the first event", async () => {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/events`, { signal: controller.signal });
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const reader = response.body?.getReader();
    const chunk = await reader?.read();
    controller.abort();
    const text = new TextDecoder().decode(chunk?.value);
    expect(text.startsWith(SSE_PREFIX)).toBe(true);
    expect(JSON.parse(text.slice(SSE_PREFIX.length))).toEqual(emptySnapshot());
  });

  it("stops without error when never started", async () => {
    const events = new SnapshotBroadcaster(new FakeProvider(), new FakeTimer(), INTERVAL_MS);
    const idle = new HttpServer(ANY_FREE_ADDRESS, { files: new StaticFileHandler(publicDir), events }, {
      info: vi.fn(),
      error: vi.fn(),
    });
    await expect(idle.stop()).resolves.toBeUndefined();
  });
});
