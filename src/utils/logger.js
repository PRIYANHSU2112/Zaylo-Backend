import pino from 'pino';
import config from '../config/index.js';

const isDev = config.env === 'development';

const pinoLogger = pino({
  name: 'zaylo-api',
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  base: {
    env: config.env,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

/**
 * Normalize (message, meta) call style onto pino's (obj, msg) API.
 * @param {import('pino').Logger} log
 * @param {'info'|'warn'|'error'|'debug'} level
 * @param {string} message
 * @param {unknown} [meta]
 */
function write(log, level, message, meta) {
  if (meta === undefined) {
    log[level](message);
    return;
  }
  if (meta instanceof Error) {
    log[level]({ err: meta }, message);
    return;
  }
  if (typeof meta === 'object' && meta !== null) {
    log[level](meta, message);
    return;
  }
  log[level]({ meta }, message);
}

const logger = {
  /**
   * @param {string} message
   * @param {unknown} [meta]
   */
  info(message, meta) {
    write(pinoLogger, 'info', message, meta);
  },
  /**
   * @param {string} message
   * @param {unknown} [meta]
   */
  warn(message, meta) {
    write(pinoLogger, 'warn', message, meta);
  },
  /**
   * @param {string} message
   * @param {unknown} [meta]
   */
  error(message, meta) {
    write(pinoLogger, 'error', message, meta);
  },
  /**
   * @param {string} message
   * @param {unknown} [meta]
   */
  debug(message, meta) {
    write(pinoLogger, 'debug', message, meta);
  },
  /** Underlying pino instance (child loggers, HTTP serializers, etc.) */
  raw: pinoLogger,
  child(bindings) {
    return pinoLogger.child(bindings);
  },
};

export default logger;
