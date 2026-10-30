/** Minimal logging sink. */
export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

/** Logger writing to the standard output and error streams. */
export const consoleLogger: Logger = {
  info: (message) => console.log(message),
  error: (message) => console.error(message),
};
