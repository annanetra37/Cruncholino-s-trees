/**
 * T10.5 — structured logging.
 *
 * One JSON object per line, which is what Railway's log viewer and any log
 * shipper downstream can actually filter on. A request id threads through a
 * single request's lines so a failure can be reconstructed.
 */
import { env } from '@/env';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold = LEVELS[env.LOG_LEVEL];

export type LogFields = Record<string, unknown>;

function write(level: Level, message: string, fields: LogFields = {}) {
  if (LEVELS[level] < threshold) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...serialise(fields),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** Errors do not survive JSON.stringify; unpack them before they vanish. */
function serialise(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof Error) {
      out[key] = { name: value.name, message: value.message, stack: value.stack };
    } else {
      out[key] = value;
    }
  }
  return out;
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write('debug', message, fields),
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
  /** Returns a logger that stamps every line with the same base fields. */
  child(base: LogFields) {
    return {
      debug: (message: string, fields?: LogFields) => write('debug', message, { ...base, ...fields }),
      info: (message: string, fields?: LogFields) => write('info', message, { ...base, ...fields }),
      warn: (message: string, fields?: LogFields) => write('warn', message, { ...base, ...fields }),
      error: (message: string, fields?: LogFields) => write('error', message, { ...base, ...fields }),
    };
  },
};

export type Logger = ReturnType<typeof logger.child>;
