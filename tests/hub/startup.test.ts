import { describe, expect, it, vi } from "vitest";
import { startAll, type Service } from "../../src/hub/startup.js";

const UDP_PORT = 9000;
const HTTP_PORT = 8080;

function startingOn(port: number): Service {
  return { start: vi.fn().mockResolvedValue(port), stop: vi.fn().mockResolvedValue(undefined) };
}

function failingWith(error: Error): Service {
  return { start: vi.fn().mockRejectedValue(error), stop: vi.fn().mockResolvedValue(undefined) };
}

describe("startAll", () => {
  it("starts every service in order and resolves with their ports", async () => {
    await expect(startAll([startingOn(UDP_PORT), startingOn(HTTP_PORT)])).resolves.toEqual([UDP_PORT, HTTP_PORT]);
  });

  it("stops the services already started and rethrows when a later one fails", async () => {
    const udp = startingOn(UDP_PORT);
    const failure = new Error("listen EADDRINUSE");
    const http = failingWith(failure);

    await expect(startAll([udp, http])).rejects.toBe(failure);
    expect(udp.stop).toHaveBeenCalledOnce();
    expect(http.stop).not.toHaveBeenCalled();
  });

  it("does not start the next services when the first one fails", async () => {
    const http = startingOn(HTTP_PORT);

    await expect(startAll([failingWith(new Error("bind EADDRINUSE")), http])).rejects.toThrow("bind EADDRINUSE");
    expect(http.start).not.toHaveBeenCalled();
  });
});
