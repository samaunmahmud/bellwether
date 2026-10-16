export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
}

export function createLogger(level: 'debug' | 'info'): Logger {
  return {
    debug: (m) => {
      if (level === 'debug') console.debug(`[debug] ${m}`);
    },
    info: (m) => console.info(`[info] ${m}`),
    warn: (m) => console.warn(`[warn] ${m}`),
  };
}

export const silentLogger: Logger = { debug: () => {}, info: () => {}, warn: () => {} };
