/**
 * Production-Safe Logging Utility
 * Provides structured logging with subsystem tags and environment-aware output
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Subsystem = 'GAME' | 'CPU' | 'COACH' | 'API' | 'ADMIN' | 'SYSTEM';

const isDevelopment = import.meta.env.DEV;
const isDebugEnabled = () => {
  try {
    return localStorage.getItem('debug') === 'true';
  } catch {
    return false;
  }
};

class Logger {
  private subsystem: Subsystem;

  constructor(subsystem: Subsystem) {
    this.subsystem = subsystem;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    return `[${timestamp}] [${this.subsystem}] ${message}`;
  }

  /**
   * Debug logs - only in development or when debug flag is set
   */
  debug(message: string, data?: any) {
    if (isDevelopment || isDebugEnabled()) {
      const formatted = this.formatMessage('debug', message, data);
      if (data !== undefined) {
        console.debug(formatted, data);
      } else {
        console.debug(formatted);
      }
    }
  }

  /**
   * Info logs - always visible
   */
  info(message: string, data?: any) {
    const formatted = this.formatMessage('info', message, data);
    if (data !== undefined) {
      console.log(formatted, data);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Warning logs - always visible
   */
  warn(message: string, data?: any) {
    const formatted = this.formatMessage('warn', message, data);
    if (data !== undefined) {
      console.warn(formatted, data);
    } else {
      console.warn(formatted);
    }
  }

  /**
   * Error logs - always visible with stack traces
   */
  error(message: string, error?: Error | any) {
    const formatted = this.formatMessage('error', message, error);
    if (error !== undefined) {
      console.error(formatted, error);
      if (error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
    } else {
      console.error(formatted);
    }
  }

  /**
   * Performance measurement
   */
  time(label: string) {
    if (isDevelopment || isDebugEnabled()) {
      console.time(`[${this.subsystem}] ${label}`);
    }
  }

  timeEnd(label: string) {
    if (isDevelopment || isDebugEnabled()) {
      console.timeEnd(`[${this.subsystem}] ${label}`);
    }
  }
}

// Export logger factory
export function createLogger(subsystem: Subsystem): Logger {
  return new Logger(subsystem);
}

// Export pre-configured loggers for common subsystems
export const gameLogger = new Logger('GAME');
export const cpuLogger = new Logger('CPU');
export const coachLogger = new Logger('COACH');
export const apiLogger = new Logger('API');
export const adminLogger = new Logger('ADMIN');
export const systemLogger = new Logger('SYSTEM');
