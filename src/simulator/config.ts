import { parseArgs } from "node:util";
import { err, ok, type Result } from "../protocol/index.js";
import { MAX_DEVICE_ID, MAX_PORT, UINT32_RANGE } from "./limits.js";

/** Validated simulator settings. */
export interface SimulatorConfig {
  readonly devices: number;
  readonly hz: number;
  readonly host: string;
  readonly port: number;
  readonly heartbeatEvery: number;
  readonly tickMs: number;
  readonly statsIntervalMs: number;
  readonly seqStart: number;
  readonly faultChecksum: number;
  readonly faultDup: number;
  readonly faultReorder: number;
  readonly faultAnomaly: number;
  readonly faultReboot: number;
  readonly faultStop: number;
  readonly stopIds: readonly number[];
  readonly stopAfterMs: number;
}

/** What the command line asks for: print help, or run with a config. */
export type CliCommand =
  | { readonly kind: "help" }
  | { readonly kind: "run"; readonly config: SimulatorConfig };

/** Environment variables read by the simulator. */
export type Env = Readonly<Record<string, string | undefined>>;

interface Parser<T> {
  readonly expected: string;
  parse(raw: string): T | undefined;
}

interface Field<T> {
  readonly flag: string;
  readonly env?: string;
  readonly fallback: T;
  readonly parser: Parser<T>;
  readonly description: string;
}

class ConfigError extends Error {}

const DECIMAL_INTEGER = /^\d+$/;
const DECIMAL_NUMBER = /^\d+(\.\d+)?$/;
const MAX_UINT32 = UINT32_RANGE - 1;
const HELP_FLAG = "help";
const MAX_HZ = 1000;
const MAX_TICK_MS = 1000;
const HELP_COLUMN_WIDTH = 30;

function integerIn(min: number, max: number): Parser<number> {
  return {
    expected: `an integer between ${min} and ${max}`,
    parse: (raw) => {
      const value = Number(raw);
      return DECIMAL_INTEGER.test(raw) && value >= min && value <= max ? value : undefined;
    },
  };
}

function numberIn(min: number, max: number, minExclusive: boolean): Parser<number> {
  const lower = minExclusive ? `greater than ${min}` : `at least ${min}`;
  return {
    expected: `a number ${lower} and at most ${max}`,
    parse: (raw) => {
      const value = Number(raw);
      const aboveMin = minExclusive ? value > min : value >= min;
      return DECIMAL_NUMBER.test(raw) && aboveMin && value <= max ? value : undefined;
    },
  };
}

const probability = numberIn(0, 1, false);

const nonEmptyText: Parser<string> = {
  expected: "a non-empty value",
  parse: (raw) => (raw.trim() === "" ? undefined : raw.trim()),
};

const deviceIdList: Parser<readonly number[]> = {
  expected: `a comma-separated list of device ids between 1 and ${MAX_DEVICE_ID}`,
  parse: (raw) => {
    if (raw === "") {
      return [];
    }
    const ids = raw.split(",").map((part) => integerIn(1, MAX_DEVICE_ID).parse(part.trim()));
    return ids.every((id) => id !== undefined) ? ids : undefined;
  },
};

/** Every option with its default, defined in one place. */
export const FIELDS = {
  devices: {
    flag: "devices",
    env: "SIM_DEVICES",
    fallback: 50,
    parser: integerIn(1, MAX_DEVICE_ID),
    description: "number of simulated devices",
  },
  hz: {
    flag: "hz",
    env: "SIM_HZ",
    fallback: 20,
    parser: numberIn(0, MAX_HZ, true),
    description: "frames per second per device",
  },
  host: {
    flag: "host",
    env: "SIM_HOST",
    fallback: "127.0.0.1",
    parser: nonEmptyText,
    description: "hub host",
  },
  port: {
    flag: "port",
    env: "SIM_PORT",
    fallback: 9000,
    parser: integerIn(1, MAX_PORT),
    description: "hub UDP port",
  },
  heartbeatEvery: {
    flag: "heartbeat-every",
    fallback: 20,
    parser: integerIn(1, MAX_UINT32),
    description: "every N-th frame is a heartbeat",
  },
  tickMs: {
    flag: "tick-ms",
    fallback: 5,
    parser: integerIn(1, MAX_TICK_MS),
    description: "scheduler tick in ms",
  },
  statsIntervalMs: {
    flag: "stats-interval-ms",
    fallback: 1000,
    parser: integerIn(1, MAX_UINT32),
    description: "stats line period in ms",
  },
  seqStart: {
    flag: "seq-start",
    fallback: 0,
    parser: integerIn(0, MAX_UINT32),
    description: "initial seq of every device",
  },
  faultChecksum: {
    flag: "fault-checksum",
    fallback: 0,
    parser: probability,
    description: "probability of a corrupted checksum",
  },
  faultDup: {
    flag: "fault-dup",
    fallback: 0,
    parser: probability,
    description: "probability of a duplicated frame",
  },
  faultReorder: {
    flag: "fault-reorder",
    fallback: 0,
    parser: probability,
    description: "probability of a frame sent after the next one",
  },
  faultAnomaly: {
    flag: "fault-anomaly",
    fallback: 0,
    parser: probability,
    description: "probability of an abnormal value",
  },
  faultReboot: {
    flag: "fault-reboot",
    fallback: 0,
    parser: probability,
    description: "probability of a reboot (seq and uptime reset)",
  },
  faultStop: {
    flag: "fault-stop",
    fallback: 0,
    parser: integerIn(0, MAX_DEVICE_ID),
    description: "number of random devices that stop",
  },
  stopIds: {
    flag: "stop-ids",
    fallback: [],
    parser: deviceIdList,
    description: "ids of the devices that stop, overrides --fault-stop",
  },
  stopAfterMs: {
    flag: "stop-after-ms",
    fallback: 10000,
    parser: integerIn(0, MAX_UINT32),
    description: "delay before stopped devices go silent",
  },
} satisfies { [K in keyof SimulatorConfig]: Field<SimulatorConfig[K]> };

const ALL_FIELDS: readonly Field<unknown>[] = Object.values(FIELDS);

/** Parses argv and env into a command. Precedence: flag, then env, then default. */
export function parseCli(argv: readonly string[], env: Env): Result<CliCommand, string> {
  try {
    const values = readFlags(argv);
    if (values[HELP_FLAG] === true) {
      return ok({ kind: "help" });
    }
    const read = <T>(field: Field<T>): T => readField(field, values, env);
    const config: SimulatorConfig = {
      devices: read(FIELDS.devices),
      hz: read(FIELDS.hz),
      host: read(FIELDS.host),
      port: read(FIELDS.port),
      heartbeatEvery: read(FIELDS.heartbeatEvery),
      tickMs: read(FIELDS.tickMs),
      statsIntervalMs: read(FIELDS.statsIntervalMs),
      seqStart: read(FIELDS.seqStart),
      faultChecksum: read(FIELDS.faultChecksum),
      faultDup: read(FIELDS.faultDup),
      faultReorder: read(FIELDS.faultReorder),
      faultAnomaly: read(FIELDS.faultAnomaly),
      faultReboot: read(FIELDS.faultReboot),
      faultStop: read(FIELDS.faultStop),
      stopIds: read(FIELDS.stopIds),
      stopAfterMs: read(FIELDS.stopAfterMs),
    };
    checkStopTargets(config);
    return ok({ kind: "run", config });
  } catch (error) {
    if (error instanceof ConfigError) {
      return err(error.message);
    }
    throw error;
  }
}

/** Help text listing every flag with its default and env variable. */
export function usage(): string {
  const lines = ALL_FIELDS.map((field) => {
    const fallback = String(field.fallback) || "none";
    const env = field.env ? `, env ${field.env}` : "";
    return `  --${field.flag} <value>`.padEnd(HELP_COLUMN_WIDTH) + `${field.description} (default ${fallback}${env})`;
  });
  return ["Usage: npm run sim -- [flags]", "", ...lines, `  --${HELP_FLAG}`.padEnd(HELP_COLUMN_WIDTH) + "show this help"].join("\n");
}

function readFlags(argv: readonly string[]): Record<string, unknown> {
  const options = Object.fromEntries([
    ...ALL_FIELDS.map((field) => [field.flag, { type: "string" } as const]),
    [HELP_FLAG, { type: "boolean" } as const],
  ]);
  try {
    return parseArgs({ args: [...argv], options, strict: true, allowPositionals: false }).values;
  } catch (error) {
    throw new ConfigError(error instanceof Error ? error.message : String(error));
  }
}

function readField<T>(field: Field<T>, values: Record<string, unknown>, env: Env): T {
  const flagValue = values[field.flag];
  const fromFlag = typeof flagValue === "string";
  const raw = fromFlag ? flagValue : field.env ? env[field.env] : undefined;
  if (raw === undefined) {
    return field.fallback;
  }
  const value = field.parser.parse(raw);
  if (value === undefined) {
    const source = fromFlag ? `--${field.flag}` : field.env;
    throw new ConfigError(`Invalid ${source} "${raw}": expected ${field.parser.expected}`);
  }
  return value;
}

function checkStopTargets(config: SimulatorConfig): void {
  if (config.faultStop > config.devices) {
    throw new ConfigError(`Invalid --fault-stop ${config.faultStop}: only ${config.devices} devices`);
  }
  const unknown = config.stopIds.find((id) => id > config.devices);
  if (unknown !== undefined) {
    throw new ConfigError(`Invalid --stop-ids: device ${unknown} does not exist`);
  }
}
