import type { Random } from "../ports.js";
import { chance } from "../random.js";
import type { Datagram, FaultStage } from "./stage.js";

/** Holds a datagram back and releases it after the next one of the same device. */
export class ReorderFault implements FaultStage {
  readonly name = "reorder";
  private count = 0;
  private readonly held = new Map<number, Datagram>();

  constructor(
    private readonly probability: number,
    private readonly random: Random,
  ) {}

  get injected(): number {
    return this.count;
  }

  apply(datagram: Datagram): Datagram[] {
    const deviceId = datagram.frame.deviceId;
    const held = this.held.get(deviceId);
    if (held) {
      this.held.delete(deviceId);
      return [datagram, held];
    }
    if (chance(this.random, this.probability)) {
      this.count += 1;
      this.held.set(deviceId, datagram);
      return [];
    }
    return [datagram];
  }
}
