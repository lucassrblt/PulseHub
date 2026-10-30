import type { Random } from "./ports.js";

/** Non-deterministic random source. */
export const mathRandom: Random = Math.random;
