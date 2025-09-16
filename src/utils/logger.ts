import chalk from 'chalk';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  error(message: string, error?: any): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(chalk.red.bold('❌ ERROR:'), message);
      if (error && this.level >= LogLevel.DEBUG) {
        console.error(chalk.red(error.stack || error));
      }
    }
  }

  warn(message: string, details?: any): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(chalk.yellow.bold('⚠️  WARN:'), message);
      if (details && this.level >= LogLevel.DEBUG) {
        console.warn(chalk.yellow(JSON.stringify(details, null, 2)));
      }
    }
  }

  info(message: string, details?: any): void {
    if (this.level >= LogLevel.INFO) {
      console.log(chalk.blue.bold('ℹ️  INFO:'), message);
      if (details && this.level >= LogLevel.DEBUG) {
        console.log(chalk.blue(JSON.stringify(details, null, 2)));
      }
    }
  }

  debug(message: string, details?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(chalk.gray.bold('🐛 DEBUG:'), message);
      if (details) {
        console.log(chalk.gray(JSON.stringify(details, null, 2)));
      }
    }
  }

  success(message: string): void {
    console.log(chalk.green.bold('✅'), message);
  }

  progress(message: string): void {
    console.log(chalk.cyan.bold('🔄'), message);
  }

  highlight(message: string): void {
    console.log(chalk.magenta.bold('🎯'), message);
  }
}

export const logger = new Logger();