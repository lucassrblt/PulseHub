import type { Random } from "../ports.js";
import { chance } from "../random.js";
import type { Datagram, FaultStage } from "./stage.js";

/** Sends the datagram twice with the given probability. */
export class DuplicateFault implements FaultStage {
  readonly name = "dup";
  private count = 0;

  constructor(
    private readonly probability: number,
    private readonly random: Random,
  ) {}

  get injected(): number {
    return this.count;
  }

  apply(datagram: Datagram): Datagram[] {
    if (!chance(this.random, this.probability)) {
      return [datagram];
    }
    this.count += 1;
    return [datagram, datagram];
  }
}
