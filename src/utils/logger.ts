import chalk from 'chalk';

/**
 * Enhanced Log Level System
 * SILENT=0: No output except critical errors
 * ERROR=1: Only errors and failures
 * WARN=2: Warnings and errors
 * INFO=3: Standard user-facing information (default)
 * VERBOSE=4: Detailed information for troubleshooting
 * DEBUG=5: Full debugging information including internals
 */
export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  VERBOSE = 4,
  DEBUG = 5,
}

/**
 * Session-based warning deduplication
 */
class WarningTracker {
  private warnings = new Set<string>();
  private sessionStart = Date.now();
  
  hasShown(message: string): boolean {
    return this.warnings.has(message);
  }
  
  markShown(message: string): void {
    this.warnings.add(message);
  }
  
  reset(): void {
    this.warnings.clear();
    this.sessionStart = Date.now();
  }
}

/**
 * Enhanced Logger with UX-focused output
 */
export class Logger {
  private level: LogLevel = LogLevel.INFO;
  private warningTracker = new WarningTracker();
  private internalLevel: LogLevel = LogLevel.DEBUG; // For system internals

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setInternalLevel(level: LogLevel): void {
    this.internalLevel = level;
  }

  /**
   * User-facing error - clean, actionable message
   */
  error(message: string, error?: any): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(chalk.red('Error:'), message);
      
      // Show technical details only in verbose/debug mode
      if (error && this.level >= LogLevel.VERBOSE) {
        if (typeof error === 'string') {
          console.error(chalk.gray('Details:'), error);
        } else if (error.message) {
          console.error(chalk.gray('Details:'), error.message);
        }
        
        // Stack trace only in debug mode
        if (this.level >= LogLevel.DEBUG && error.stack) {
          console.error(chalk.gray('Stack:'), error.stack);
        }
      }
    }
  }

  /**
   * User-facing warning with deduplication
   */
  warn(message: string, details?: any): void {
    if (this.level >= LogLevel.WARN) {
      // Deduplicate warnings in the same session
      const warningKey = message + (details ? JSON.stringify(details) : '');
      if (this.warningTracker.hasShown(warningKey)) {
        return;
      }
      this.warningTracker.markShown(warningKey);
      
      console.warn(chalk.yellow('Warning:'), message);
      
      // Show details only in verbose mode
      if (details && this.level >= LogLevel.VERBOSE) {
        console.warn(chalk.gray('Details:'), typeof details === 'object' ? JSON.stringify(details, null, 2) : details);
      }
    }
  }

  /**
   * Standard user-facing information
   */
  info(message: string, details?: any): void {
    if (this.level >= LogLevel.INFO) {
      console.log(message);
      
      // Show details only in verbose mode
      if (details && this.level >= LogLevel.VERBOSE) {
        console.log(chalk.gray('Details:'), typeof details === 'object' ? JSON.stringify(details, null, 2) : details);
      }
    }
  }

  /**
   * Verbose information for troubleshooting
   */
  verbose(message: string, details?: any): void {
    if (this.level >= LogLevel.VERBOSE) {
      console.log(chalk.gray(message));
      
      if (details) {
        console.log(chalk.gray(typeof details === 'object' ? JSON.stringify(details, null, 2) : details));
      }
    }
  }

  /**
   * Debug information for development
   */
  debug(message: string, details?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(chalk.gray('[DEBUG]'), chalk.gray(message));
      
      if (details) {
        console.log(chalk.gray(typeof details === 'object' ? JSON.stringify(details, null, 2) : details));
      }
    }
  }

  /**
   * Internal system logging - separate from user-facing logs
   */
  internal(level: 'error' | 'warn' | 'info' | 'debug', message: string, details?: any): void {
    const requiredLevel = {
      'error': LogLevel.ERROR,
      'warn': LogLevel.WARN, 
      'info': LogLevel.INFO,
      'debug': LogLevel.DEBUG
    }[level];
    
    if (this.internalLevel >= requiredLevel) {
      // Only show internal logs in debug mode
      if (this.level >= LogLevel.DEBUG) {
        const prefix = chalk.gray(`[INTERNAL-${level.toUpperCase()}]`);
        console.log(prefix, chalk.gray(message));
        
        if (details && this.internalLevel >= LogLevel.DEBUG) {
          console.log(chalk.gray(typeof details === 'object' ? JSON.stringify(details, null, 2) : details));
        }
      }
    }
  }

  /**
   * Clean success message
   */
  success(message: string): void {
    if (this.level >= LogLevel.INFO) {
      console.log(chalk.green('✓'), message);
    }
  }

  /**
   * Clean failure message  
   */
  failure(message: string): void {
    if (this.level >= LogLevel.ERROR) {
      console.log(chalk.red('✗'), message);
    }
  }

  /**
   * Minimal progress indication (only for long operations)
   */
  progress(message: string): void {
    if (this.level >= LogLevel.INFO) {
      console.log(chalk.cyan(message));
    }
  }

  /**
   * Highlighted important information
   */
  highlight(message: string): void {
    if (this.level >= LogLevel.INFO) {
      console.log(chalk.bold(message));
    }
  }

  /**
   * Reset session-based tracking
   */
  resetSession(): void {
    this.warningTracker.reset();
  }

  /**
   * Get current level for conditional logging
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Check if level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.level >= level;
  }
}

export const logger = new Logger();

// Legacy methods for backward compatibility
export const legacyLogger = {
  error: (message: string, error?: any) => logger.error(message, error),
  warn: (message: string, details?: any) => logger.warn(message, details), 
  info: (message: string, details?: any) => logger.info(message, details),
  debug: (message: string, details?: any) => logger.debug(message, details),
  success: (message: string) => logger.success(message),
  progress: (message: string) => logger.progress(message),
  highlight: (message: string) => logger.highlight(message)
};