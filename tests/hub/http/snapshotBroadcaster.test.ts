import { beforeEach, describe, expect, it } from "vitest";
import { SnapshotBroadcaster, toSseMessage } from "../../../src/hub/http/snapshotBroadcaster.js";
import { FakeClient, FakeProvider, FakeTimer, emptySnapshot } from "./fakes.js";

const INTERVAL_MS = 250;

describe("SnapshotBroadcaster", () => {
  let provider: FakeProvider;
  let timer: FakeTimer;
  let broadcaster: SnapshotBroadcaster;

  beforeEach(() => {
    provider = new FakeProvider();
    timer = new FakeTimer();
    broadcaster = new SnapshotBroadcaster(provider, timer, INTERVAL_MS);
    broadcaster.start();
  });

  it("formats a snapshot as one SSE data message", () => {
    expect(toSseMessage(emptySnapshot())).toBe(`data: ${JSON.stringify(emptySnapshot())}\n\n`);
  });

  it("opens an event stream and sends the current snapshot at once", () => {
    const client = new FakeClient();
    broadcaster.connect(client);
    expect(client.statusCode).toBe(200);
    expect(client.headers).toEqual({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    expect(client.chunks).toEqual([toSseMessage(emptySnapshot())]);
  });

  it("pushes the latest snapshot to every client on each tick", () => {
    const first = new FakeClient();
    const second = new FakeClient();
    broadcaster.connect(first);
    broadcaster.connect(second);
    provider.uptimeMs = 1000;
    timer.fire();
    expect(first.chunks.at(-1)).toBe(toSseMessage(emptySnapshot(1000)));
    expect(second.chunks.at(-1)).toBe(toSseMessage(emptySnapshot(1000)));
  });

  it("stops pushing to a closed client", () => {
    const kept = new FakeClient();
    const closed = new FakeClient();
    broadcaster.connect(kept);
    broadcaster.connect(closed);
    closed.close();
    timer.fire();
    expect(broadcaster.clientCount).toBe(1);
    expect(kept.chunks).toHaveLength(2);
    expect(closed.chunks).toHaveLength(1);
  });

  it("ends the clients and cancels the timer on stop", () => {
    const client = new FakeClient();
    broadcaster.connect(client);
    broadcaster.stop();
    expect(client.ended).toBe(true);
    expect(broadcaster.clientCount).toBe(0);
    expect(timer.pending).toBe(0);
  });
});
