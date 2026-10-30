import { encodeFrame, type Frame } from "../../protocol/index.js";
import type { Device } from "../device.js";

/** Outgoing frame with the bytes that will be sent for it. */
export interface Datagram {
  readonly frame: Frame;
  readonly bytes: Uint8Array;
}

/** Fault that counts how many times it was injected. */
export interface FaultCounter {
  readonly name: string;
  readonly injected: number;
}

/** Fault on the outgoing stream: turns one datagram into zero, one or more datagrams. */
export interface FaultStage extends FaultCounter {
  apply(datagram: Datagram): Datagram[];
}

/** Fault on a device's state, applied before it builds its next frame. */
export interface DeviceFault extends FaultCounter {
  beforeFrame(device: Device, nowMs: number): void;
}

/** Encodes a frame into a datagram with a valid checksum. */
export function toDatagram(frame: Frame): Datagram {
  return { frame, bytes: encodeFrame(frame) };
}

/** Runs a datagram through the stages in order. */
export function runStages(stages: readonly FaultStage[], datagram: Datagram): Datagram[] {
  return stages.reduce<Datagram[]>(
    (batch, stage) => batch.flatMap((item) => stage.apply(item)),
    [datagram],
  );
}
