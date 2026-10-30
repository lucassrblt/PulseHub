import type { Clock, Random } from "../ports.js";
import { randomInt } from "../random.js";
import type { Datagram, FaultStage } from "./stage.js";

/** Drops every datagram of the stopped devices once the stop time is reached. */
export class StopFault implements FaultStage {
  readonly name = "stopped";
  private count = 0;

  constructor(
    private readonly stoppedIds: ReadonlySet<number>,
    private readonly stopAtMs: number,
    private readonly clock: Clock,
  ) {}

  get injected(): number {
    return this.count;
  }

  apply(datagram: Datagram): Datagram[] {
    if (this.stoppedIds.has(datagram.frame.deviceId) && this.clock.now() >= this.stopAtMs) {
      this.count += 1;
      return [];
    }
    return [datagram];
  }
}

/** Picks count distinct device ids in 1..deviceCount, sorted ascending. */
export function pickStoppedIds(count: number, deviceCount: number, random: Random): number[] {
  const ids = Array.from({ length: deviceCount }, (_, index) => index + 1);
  for (let index = 0; index < count; index++) {
    const swapWith = randomInt(random, index, deviceCount - 1);
    [ids[index], ids[swapWith]] = [ids[swapWith] ?? 0, ids[index] ?? 0];
  }
  return ids.slice(0, count).sort((a, b) => a - b);
}
