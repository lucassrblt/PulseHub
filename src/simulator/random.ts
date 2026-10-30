import type { Random } from "./ports.js";

/** Whether an event of the given probability happens on this draw. */
export function chance(random: Random, probability: number): boolean {
  return random() < probability;
}

/** Integer drawn uniformly in [min, max]. */
export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}
