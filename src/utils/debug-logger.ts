import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
  command?: string;
  args?: string[];
  cwd?: string;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: {
    duration?: number;
    step?: string;
    templateId?: string;
    fileName?: string;
    [key: string]: any;
  };
}

export interface DebugLoggerOptions {
  level: LogLevel;
  enableFileLogging: boolean;
  logDirectory: string;
  enableConsole: boolean;
  enableTrace: boolean;
  maxLogFiles: number;
  maxLogSizeBytes: number;
}

export class DebugLogger {
  private options: DebugLoggerOptions;
  private logStream: fs.WriteStream | null = null;
  private currentCommand: string | null = null;
  private commandStartTime: number | null = null;
  private currentLogFile: string | null = null;

  constructor(options: Partial<DebugLoggerOptions> = {}) {
    this.options = {
      level: LogLevel.INFO,
      enableFileLogging: true,
      logDirectory: path.join(os.homedir(), '.apix', 'logs'),
      enableConsole: true,
      enableTrace: false,
      maxLogFiles: 10,
      maxLogSizeBytes: 10 * 1024 * 1024, // 10MB
      ...options
    };

    if (this.options.enableFileLogging) {
      this.initializeFileLogging();
    }
  }

  private async initializeFileLogging(): Promise<void> {
    try {
      await fs.ensureDir(this.options.logDirectory);

      // Clean up old log files
      await this.rotateLogFiles();

      // Create new log file
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      this.currentLogFile = path.join(this.options.logDirectory, `apix-${timestamp}.log`);

      this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });

      // Log session start
      this.writeLogEntry({
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        message: '=== APIX AI Session Started ===',
        context: {
          version: process.env.npm_package_version || 'unknown',
          node: process.version,
          platform: os.platform(),
          arch: os.arch(),
          cwd: process.cwd()
        }
      });
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Failed to initialize file logging:'), error);
      this.options.enableFileLogging = false;
    }
  }

  private async rotateLogFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.options.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith('apix-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.options.logDirectory, file),
          stats: fs.statSync(path.join(this.options.logDirectory, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      // Remove old files beyond maxLogFiles
      const filesToDelete = logFiles.slice(this.options.maxLogFiles);
      for (const file of filesToDelete) {
        await fs.remove(file.path);
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Failed to rotate log files:'), error);
    }
  }

  setLevel(level: LogLevel): void {
    this.options.level = level;
  }

  setFileLogging(enabled: boolean): void {
    this.options.enableFileLogging = enabled;
    if (enabled && !this.logStream) {
      this.initializeFileLogging();
    } else if (!enabled && this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }

  setTrace(enabled: boolean): void {
    this.options.enableTrace = enabled;
    if (enabled) {
      this.options.level = Math.max(this.options.level, LogLevel.TRACE);
    }
  }

  startCommand(command: string, args: string[] = []): void {
    this.currentCommand = command;
    this.commandStartTime = Date.now();

    this.trace('Command started', {
      command,
      args,
      cwd: process.cwd(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        HEDERA_NETWORK: process.env.HEDERA_NETWORK,
        HEDERA_ACCOUNT_ID: process.env.HEDERA_ACCOUNT_ID ? '***' : 'not_set'
      }
    });
  }

  endCommand(success: boolean = true, result?: any): void {
    if (this.currentCommand && this.commandStartTime) {
      const duration = Date.now() - this.commandStartTime;

      this.info(`Command ${success ? 'completed' : 'failed'}`, {
        command: this.currentCommand,
        duration: `${duration}ms`,
        success,
        result: success ? result : undefined
      });

      this.currentCommand = null;
      this.commandStartTime = null;
    }
  }

  private writeLogEntry(entry: LogEntry): void {
    // Write to file
    if (this.options.enableFileLogging && this.logStream) {
      const logLine = JSON.stringify(entry) + '\n';
      this.logStream.write(logLine);
    }
  }

  private formatConsoleMessage(level: LogLevel, message: string, context?: any): string {
    const levelColors = {
      [LogLevel.ERROR]: chalk.red.bold('❌ ERROR:'),
      [LogLevel.WARN]: chalk.yellow.bold('⚠️  WARN:'),
      [LogLevel.INFO]: chalk.blue.bold('ℹ️  INFO:'),
      [LogLevel.DEBUG]: chalk.gray.bold('🐛 DEBUG:'),
      [LogLevel.TRACE]: chalk.magenta.bold('🔍 TRACE:')
    };

    let output = `${levelColors[level]} ${message}`;

    if (context && this.options.level >= LogLevel.DEBUG) {
      if (typeof context === 'object') {
        output += '\n' + chalk.gray(JSON.stringify(context, null, 2));
      } else {
        output += ' ' + chalk.gray(context);
      }
    }

    return output;
  }

  error(message: string, error?: any, context?: any): void {
    if (this.options.level >= LogLevel.ERROR) {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.ERROR,
        message,
        command: this.currentCommand || undefined,
        context,
        error: error ? {
          message: error.message || String(error),
          stack: this.options.enableTrace ? error.stack : undefined,
          code: error.code
        } : undefined
      };

      this.writeLogEntry(logEntry);

      if (this.options.enableConsole) {
        console.error(this.formatConsoleMessage(LogLevel.ERROR, message, context));
        if (error && this.options.enableTrace && error.stack) {
          console.error(chalk.red(error.stack));
        }
      }
    }
  }

  warn(message: string, context?: any): void {
    if (this.options.level >= LogLevel.WARN) {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.WARN,
        message,
        command: this.currentCommand || undefined,
        context
      };

      this.writeLogEntry(logEntry);

      if (this.options.enableConsole) {
        console.warn(this.formatConsoleMessage(LogLevel.WARN, message, context));
      }
    }
  }

  info(message: string, context?: any): void {
    if (this.options.level >= LogLevel.INFO) {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        message,
        command: this.currentCommand || undefined,
        context
      };

      this.writeLogEntry(logEntry);

      if (this.options.enableConsole) {
        console.log(this.formatConsoleMessage(LogLevel.INFO, message, context));
      }
    }
  }

  debug(message: string, context?: any): void {
    if (this.options.level >= LogLevel.DEBUG) {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.DEBUG,
        message,
        command: this.currentCommand || undefined,
        context
      };

      this.writeLogEntry(logEntry);

      if (this.options.enableConsole) {
        console.log(this.formatConsoleMessage(LogLevel.DEBUG, message, context));
      }
    }
  }

  trace(message: string, context?: any): void {
    if (this.options.level >= LogLevel.TRACE || this.options.enableTrace) {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.TRACE,
        message,
        command: this.currentCommand || undefined,
        context,
        metadata: {
          stack: this.options.enableTrace ? new Error().stack : undefined
        }
      };

      this.writeLogEntry(logEntry);

      if (this.options.enableConsole) {
        console.log(this.formatConsoleMessage(LogLevel.TRACE, message, context));
      }
    }
  }

  success(message: string, context?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message: `✅ ${message}`,
      command: this.currentCommand || undefined,
      context
    };

    this.writeLogEntry(logEntry);

    if (this.options.enableConsole) {
      console.log(chalk.green.bold('✅'), message);
      if (context && this.options.level >= LogLevel.DEBUG) {
        console.log(chalk.gray(JSON.stringify(context, null, 2)));
      }
    }
  }

  progress(message: string, context?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message: `🔄 ${message}`,
      command: this.currentCommand || undefined,
      context
    };

    this.writeLogEntry(logEntry);

    if (this.options.enableConsole) {
      console.log(chalk.cyan.bold('🔄'), message);
    }
  }

  step(step: string, message: string, context?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      command: this.currentCommand || undefined,
      context,
      metadata: { step }
    };

    this.writeLogEntry(logEntry);

    if (this.options.enableConsole && this.options.level >= LogLevel.DEBUG) {
      console.log(chalk.cyan.bold(`📋 [${step}]`), message);
    }
  }

  template(templateId: string, message: string, context?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      command: this.currentCommand || undefined,
      context,
      metadata: { templateId }
    };

    this.writeLogEntry(logEntry);

    if (this.options.enableConsole && this.options.level >= LogLevel.DEBUG) {
      console.log(chalk.blue.bold(`📝 [${templateId}]`), message);
    }
  }

  file(fileName: string, message: string, context?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      command: this.currentCommand || undefined,
      context,
      metadata: { fileName }
    };

    this.writeLogEntry(logEntry);

    if (this.options.enableConsole && this.options.level >= LogLevel.DEBUG) {
      console.log(chalk.green.bold(`📁 [${fileName}]`), message);
    }
  }

  async getRecentLogs(count: number = 50): Promise<LogEntry[]> {
    if (!this.currentLogFile || !await fs.pathExists(this.currentLogFile)) {
      return [];
    }

    try {
      const content = await fs.readFile(this.currentLogFile, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      const entries = lines
        .slice(-count)
        .map(line => {
          try {
            return JSON.parse(line) as LogEntry;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is LogEntry => entry !== null);

      return entries;
    } catch (error) {
      this.error('Failed to read recent logs', error);
      return [];
    }
  }

  async getLastError(): Promise<LogEntry | null> {
    const logs = await this.getRecentLogs(100);
    return logs.reverse().find(log => log.level === LogLevel.ERROR) || null;
  }

  getLogDirectory(): string {
    return this.options.logDirectory;
  }

  getCurrentLogFile(): string | null {
    return this.currentLogFile;
  }

  async cleanup(): Promise<void> {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}

// Global debug logger instance
export const debugLogger = new DebugLogger();