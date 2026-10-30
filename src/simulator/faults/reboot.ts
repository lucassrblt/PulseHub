import type { Device } from "../device.js";
import type { Random } from "../ports.js";
import { chance } from "../random.js";
import type { DeviceFault } from "./stage.js";

/** Restarts the device with the given probability, resetting its seq and uptime. */
export class RebootFault implements DeviceFault {
  readonly name = "reboot";
  private count = 0;

  constructor(
    private readonly probability: number,
    private readonly random: Random,
  ) {}

  get injected(): number {
    return this.count;
  }

  beforeFrame(device: Device, nowMs: number): void {
    if (chance(this.random, this.probability)) {
      this.count += 1;
      device.reboot(nowMs);
    }
  }
}
