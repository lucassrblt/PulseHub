import { createSocket } from "node:dgram";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../src/hub/logger.js";
import { UdpReceiver, type DatagramHandler } from "../../src/hub/udpReceiver.js";

const ANY_FREE_PORT = 0;
const LOOPBACK = "127.0.0.1";

function silentLogger(): Logger {
  return { info: vi.fn(), error: vi.fn() };
}

function send(port: number, bytes: Uint8Array): Promise<void> {
  const client = createSocket("udp4");
  return new Promise((resolve, reject) =>
    client.send(bytes, port, LOOPBACK, (error) => {
      client.close();
      return error ? reject(error) : resolve();
    }),
  );
}

describe("UdpReceiver", () => {
  let receiver: UdpReceiver | undefined;

  afterEach(async () => {
    await receiver?.stop();
  });

  async function startWith(handler: DatagramHandler, logger: Logger): Promise<number> {
    receiver = new UdpReceiver(ANY_FREE_PORT, handler, logger);
    return receiver.start();
  }

  it("hands every datagram to the handler", async () => {
    const received: Uint8Array[] = [];
    const port = await startWith((bytes) => received.push(Uint8Array.from(bytes)), silentLogger());
    await send(port, new Uint8Array([1, 2, 3]));
    await vi.waitFor(() => expect(received).toEqual([new Uint8Array([1, 2, 3])]));
  });

  it("logs a failing handler and keeps receiving", async () => {
    const logger = silentLogger();
    let calls = 0;
    const port = await startWith(() => {
      calls++;
      throw new Error("boom");
    }, logger);
    await send(port, new Uint8Array([1]));
    await send(port, new Uint8Array([2]));
    await vi.waitFor(() => expect(calls).toBe(2));
    expect(logger.error).toHaveBeenCalledWith("datagram handler failed: boom");
  });

  it("rejects start when the port is already taken", async () => {
    const port = await startWith(() => undefined, silentLogger());
    const second = new UdpReceiver(port, () => undefined, silentLogger());
    await expect(second.start()).rejects.toThrow();
  });

  it("stops without error when never started", async () => {
    await expect(new UdpReceiver(ANY_FREE_PORT, () => undefined, silentLogger()).stop()).resolves.toBeUndefined();
  });
});
