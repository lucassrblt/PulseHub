import type { Device } from "./device.js";
import { runStages, toDatagram, type DeviceFault, type FaultStage } from "./faults/stage.js";
import type { Cancel, Clock, Timer } from "../shared/time.js";
import type { DatagramSender } from "./ports.js";

/** Collaborators and timing of a simulation run. */
export interface SimulatorDeps {
  readonly devices: readonly Device[];
  readonly deviceFaults: readonly DeviceFault[];
  readonly stages: readonly FaultStage[];
  readonly sender: DatagramSender;
  readonly clock: Clock;
  readonly timer: Timer;
  readonly periodMs: number;
  readonly tickMs: number;
}

const MAX_CATCH_UP_TICKS = 2;

interface Slot {
  readonly device: Device;
  dueMs: number;
}

/**
 * Single timer loop that emits, on each tick, every frame that is due, with device start times spread evenly.
 * A device emits at most MAX_CATCH_UP_TICKS ticks worth of frames per tick; a larger backlog is skipped.
 */
export class Simulator {
  private readonly slots: Slot[];
  private readonly maxFramesPerTick: number;
  private cancel: Cancel | undefined;
  private sent = 0;

  constructor(private readonly deps: SimulatorDeps) {
    const startMs = deps.clock.now();
    const spacingMs = deps.periodMs / deps.devices.length;
    this.slots = deps.devices.map((device, index) => ({ device, dueMs: startMs + index * spacingMs }));
    this.maxFramesPerTick = Math.ceil((MAX_CATCH_UP_TICKS * deps.tickMs) / deps.periodMs);
  }

  /** Datagrams handed to the sender so far. */
  get framesSent(): number {
    return this.sent;
  }

  /** Starts the timer loop. */
  start(): void {
    this.cancel = this.deps.timer.every(this.deps.tickMs, () => this.tick());
  }

  /** Stops the timer loop. */
  stop(): void {
    this.cancel?.();
    this.cancel = undefined;
  }

  private tick(): void {
    const nowMs = this.deps.clock.now();
    for (const slot of this.slots) {
      for (let emitted = 0; slot.dueMs <= nowMs && emitted < this.maxFramesPerTick; emitted++) {
        this.emit(slot.device, nowMs);
        slot.dueMs += this.deps.periodMs;
      }
      if (slot.dueMs <= nowMs) {
        this.skipBacklog(slot, nowMs);
      }
    }
  }

  private skipBacklog(slot: Slot, nowMs: number): void {
    const missed = Math.floor((nowMs - slot.dueMs) / this.deps.periodMs) + 1;
    slot.dueMs += missed * this.deps.periodMs;
  }

  private emit(device: Device, nowMs: number): void {
    this.deps.deviceFaults.forEach((fault) => fault.beforeFrame(device, nowMs));
    const datagrams = runStages(this.deps.stages, toDatagram(device.nextFrame(nowMs)));
    for (const datagram of datagrams) {
      this.deps.sender.send(datagram.bytes);
      this.sent += 1;
    }
  }
}
