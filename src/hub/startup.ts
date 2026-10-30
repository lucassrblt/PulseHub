/** Host and port a server listens on. */
export interface ListenAddress {
  readonly host: string;
  readonly port: number;
}

/** A server that binds a port on start and releases it on stop. */
export interface Service {
  start(): Promise<number>;
  stop(): Promise<void>;
}

/** Starts the services in order and resolves with their bound ports; on failure stops the started ones and rethrows. */
export async function startAll(services: readonly Service[]): Promise<number[]> {
  const started: Service[] = [];
  const ports: number[] = [];
  try {
    for (const service of services) {
      ports.push(await service.start());
      started.push(service);
    }
    return ports;
  } catch (error) {
    await Promise.all(started.map((service) => service.stop()));
    throw error;
  }
}
