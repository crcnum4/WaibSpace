/**
 * Lightweight structured logger with level filtering and trace correlation.
 *
 * Output format: newline-delimited JSON (one object per log line).
 * Respects the LOG_LEVEL environment variable (default: "info").
 *
 * No external dependencies — uses console.log/error for output.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  level: LogLevel;
  msg: string;
  component: string;
  timestamp: string;
  traceId?: string;
  [key: string]: unknown;
}

export interface LoggerOptions {
  /** Component/module name included in every log entry */
  component: string;
  /** Optional trace ID to correlate logs across the pipeline */
  traceId?: string;
  /** Override the minimum log level (defaults to LOG_LEVEL env or "info") */
  level?: LogLevel;
}

function getEnvLevel(): LogLevel {
  const env = (typeof process !== "undefined" && process.env?.LOG_LEVEL) || "info";
  const normalized = env.toLowerCase() as LogLevel;
  return normalized in LEVEL_ORDER ? normalized : "info";
}

export class Logger {
  readonly component: string;
  readonly traceId: string | undefined;
  private minLevel: number;

  constructor(options: LoggerOptions) {
    this.component = options.component;
    this.traceId = options.traceId;
    this.minLevel = LEVEL_ORDER[options.level ?? getEnvLevel()];
  }

  /**
   * Create a child logger that inherits the parent's settings but can override
   * component name and/or traceId.
   */
  child(overrides: Partial<LoggerOptions>): Logger {
    return new Logger({
      component: overrides.component ?? this.component,
      traceId: overrides.traceId ?? this.traceId,
      level: overrides.level,
    });
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.write("debug", msg, data);
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.write("info", msg, data);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.write("warn", msg, data);
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.write("error", msg, data);
  }

  private write(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < this.minLevel) return;

    const entry: LogEntry = {
      level,
      msg,
      component: this.component,
      timestamp: new Date().toISOString(),
      ...(this.traceId ? { traceId: this.traceId } : {}),
      ...data,
    };

    const line = JSON.stringify(entry);

    // Use console.error for warn/error so they go to stderr;
    // debug/info go to stdout via console.log.
    if (level === "error" || level === "warn") {
      console.error(line);
    } else {
      console.log(line);
    }
  }
}

/**
 * Create a root logger for a given component.
 * Shorthand for `new Logger({ component })`.
 */
export function createLogger(component: string, traceId?: string): Logger {
  return new Logger({ component, traceId });
}
