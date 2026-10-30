import { CHECKSUM_SIZE } from "../../protocol/index.js";
import type { Random } from "../ports.js";
import { chance } from "../random.js";
import type { Datagram, FaultStage } from "./stage.js";

const CHECKSUM_FLIP_MASK = 0xff;

/** Corrupts the trailing checksum byte with the given probability. */
export class ChecksumFault implements FaultStage {
  readonly name = "checksum";
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
    const bytes = Uint8Array.from(datagram.bytes);
    const checksumAt = bytes.length - CHECKSUM_SIZE;
    bytes[checksumAt] = (bytes[checksumAt] ?? 0) ^ CHECKSUM_FLIP_MASK;
    return [{ frame: datagram.frame, bytes }];
  }
}
