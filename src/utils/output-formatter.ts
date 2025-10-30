import chalk from 'chalk';
import { logger, LogLevel } from './logger';

/**
 * Professional CLI Output Formatter
 * Provides consistent, clean formatting for all CLI outputs matching industry standards
 */
export class OutputFormatter {
  private maxWidth = 80;
  private quiet = false;
  private jsonMode = false;

  constructor(options: { maxWidth?: number; quiet?: boolean; jsonMode?: boolean } = {}) {
    this.maxWidth = options.maxWidth || 80;
    this.quiet = options.quiet || false;
    this.jsonMode = options.jsonMode || false;
  }

  /**
   * Format command success message
   */
  success(message: string, details?: any): void {
    if (this.quiet) return;
    
    if (this.jsonMode) {
      console.log(JSON.stringify({ status: 'success', message, details }, null, 2));
      return;
    }

    console.log(chalk.green('✓'), message);
    if (details && logger.isLevelEnabled(LogLevel.VERBOSE)) {
      this.details(details);
    }
  }

  /**
   * Format command error message
   */
  error(message: string, error?: any): void {
    if (this.jsonMode) {
      console.log(JSON.stringify({ 
        status: 'error', 
        message, 
        error: error?.message || error 
      }, null, 2));
      return;
    }

    console.error(chalk.red('✗'), message);
    if (error && logger.isLevelEnabled(LogLevel.VERBOSE)) {
      this.details(error);
    }
  }

  /**
   * Format warning message
   */
  warning(message: string, details?: any): void {
    if (this.quiet) return;
    
    if (this.jsonMode) {
      console.log(JSON.stringify({ status: 'warning', message, details }, null, 2));
      return;
    }

    console.warn(chalk.yellow('⚠'), message);
    if (details && logger.isLevelEnabled(LogLevel.VERBOSE)) {
      this.details(details);
    }
  }

  /**
   * Format section header
   */
  section(title: string): void {
    if (this.quiet) return;
    if (this.jsonMode) return;

    console.log('\n' + chalk.bold(title));
    console.log('─'.repeat(Math.min(title.length, this.maxWidth)));
  }

  /**
   * Format sub-header
   */
  subheader(title: string): void {
    if (this.quiet) return;
    if (this.jsonMode) return;

    console.log('\n' + chalk.bold.cyan(title));
  }

  /**
   * Format key-value pairs
   */
  keyValue(key: string, value: string | number, options: { 
    indent?: number; 
    color?: 'green' | 'yellow' | 'red' | 'cyan' | 'gray'; 
    maxValueLength?: number;
  } = {}): void {
    if (this.quiet) return;
    if (this.jsonMode) return;

    const indent = ' '.repeat(options.indent || 2);
    const colorFn = options.color ? chalk[options.color] : chalk.white;
    const maxLen = options.maxValueLength || 50;
    
    let displayValue = String(value);
    if (displayValue.length > maxLen) {
      displayValue = displayValue.substring(0, maxLen - 3) + '...';
    }

    console.log(`${indent}${chalk.gray(key + ':')} ${colorFn(displayValue)}`);
  }

  /**
   * Format list items
   */
  list(items: string[], options: { 
    indent?: number; 
    bullet?: string;
    numbered?: boolean;
  } = {}): void {
    if (this.quiet) return;
    if (this.jsonMode) return;

    const indent = ' '.repeat(options.indent || 2);
    const bullet = options.bullet || '•';

    items.forEach((item, index) => {
      const prefix = options.numbered ? `${index + 1}.` : bullet;
      console.log(`${indent}${chalk.cyan(prefix)} ${item}`);
    });
  }

  /**
   * Format actionable items with commands
   */
  actionableList(items: Array<{ label: string; command?: string; description?: string }>, options: {
    indent?: number;
  } = {}): void {
    if (this.quiet) return;
    
    if (this.jsonMode) {
      console.log(JSON.stringify({ actionableItems: items }, null, 2));
      return;
    }

    const indent = ' '.repeat(options.indent || 2);
    
    items.forEach((item, index) => {
      console.log(`${indent}${chalk.cyan((index + 1) + '.')} ${item.label}`);
      
      if (item.command) {
        console.log(`${indent}   ${chalk.gray('Command:')} ${chalk.green(item.command)}`);
      }
      
      if (item.description && logger.isLevelEnabled(LogLevel.VERBOSE)) {
        console.log(`${indent}   ${chalk.gray(item.description)}`);
      }
    });
  }

  /**
   * Format file path with smart truncation
   */
  filePath(path: string, options: { relative?: boolean; maxLength?: number } = {}): string {
    const maxLen = options.maxLength || 60;
    
    if (path.length <= maxLen) {
      return chalk.cyan(path);
    }

    // Smart truncation - show beginning and end
    const start = path.substring(0, Math.floor(maxLen / 2) - 2);
    const end = path.substring(path.length - Math.floor(maxLen / 2) + 2);
    return chalk.cyan(`${start}...${end}`);
  }

  /**
   * Format URL with smart truncation
   */
  url(url: string, options: { maxLength?: number } = {}): string {
    const maxLen = options.maxLength || 50;
    
    if (url.length <= maxLen) {
      return chalk.blue.underline(url);
    }

    const truncated = url.substring(0, maxLen - 3) + '...';
    return chalk.blue.underline(truncated);
  }

  /**
   * Format table data
   */
  table(data: Array<Record<string, string | number>>, options: {
    headers?: string[];
    maxWidth?: number;
  } = {}): void {
    if (this.quiet) return;
    
    if (this.jsonMode) {
      console.log(JSON.stringify({ table: data }, null, 2));
      return;
    }

    if (data.length === 0) return;

    const headers = options.headers || Object.keys(data[0]);
    const maxWidth = options.maxWidth || this.maxWidth;
    const colWidth = Math.floor(maxWidth / headers.length) - 2;

    // Header
    const headerRow = headers.map(h => 
      chalk.bold(h.padEnd(colWidth).substring(0, colWidth))
    ).join('  ');
    console.log(headerRow);
    console.log('─'.repeat(maxWidth));

    // Data rows
    data.forEach(row => {
      const dataRow = headers.map(header => {
        const value = String(row[header] || '');
        return value.padEnd(colWidth).substring(0, colWidth);
      }).join('  ');
      console.log(dataRow);
    });
  }

  /**
   * Format progress completion
   */
  completion(message: string, stats?: { duration?: number; count?: number }): void {
    if (this.quiet) return;
    
    if (this.jsonMode) {
      console.log(JSON.stringify({ 
        status: 'completed', 
        message, 
        stats 
      }, null, 2));
      return;
    }

    let output = chalk.green('✓') + ' ' + message;
    
    if (stats && logger.isLevelEnabled(LogLevel.VERBOSE)) {
      const parts = [];
      if (stats.duration) {
        parts.push(`${stats.duration}ms`);
      }
      if (stats.count !== undefined) {
        parts.push(`${stats.count} items`);
      }
      if (parts.length > 0) {
        output += chalk.gray(` (${parts.join(', ')})`);
      }
    }
    
    console.log(output);
  }

  /**
   * Format next steps
   */
  nextSteps(steps: string[]): void {
    if (this.quiet) return;
    if (this.jsonMode) {
      console.log(JSON.stringify({ nextSteps: steps }, null, 2));
      return;
    }

    if (steps.length === 0) return;

    console.log('\n' + chalk.bold('Next steps:'));
    this.list(steps, { numbered: true });
  }

  /**
   * Format code block
   */
  codeBlock(code: string, language?: string): void {
    if (this.quiet) return;
    if (this.jsonMode) return;

    const lines = code.split('\n');
    console.log(chalk.gray('```' + (language || '')));
    lines.forEach(line => {
      console.log(chalk.gray(line));
    });
    console.log(chalk.gray('```'));
  }

  /**
   * Format details/metadata (shown only in verbose mode)
   */
  details(details: any): void {
    if (this.quiet || !logger.isLevelEnabled(LogLevel.VERBOSE)) return;
    
    if (this.jsonMode) {
      console.log(JSON.stringify({ details }, null, 2));
      return;
    }

    if (typeof details === 'string') {
      console.log(chalk.gray('Details: ' + details));
    } else if (typeof details === 'object') {
      console.log(chalk.gray('Details:'));
      console.log(chalk.gray(JSON.stringify(details, null, 2)));
    }
  }

  /**
   * Format separator line
   */
  separator(char: string = '─', width?: number): void {
    if (this.quiet || this.jsonMode) return;
    console.log(char.repeat(width || this.maxWidth));
  }

  /**
   * Format blank line
   */
  blank(): void {
    if (this.quiet || this.jsonMode) return;
    console.log();
  }

  /**
   * Format spinner replacement for quick operations
   */
  working(message: string): void {
    if (this.quiet) return;
    if (this.jsonMode) return;
    
    console.log(chalk.cyan('◦'), message);
  }

  /**
   * Set formatting options
   */
  configure(options: { quiet?: boolean; jsonMode?: boolean; maxWidth?: number }): void {
    if (options.quiet !== undefined) this.quiet = options.quiet;
    if (options.jsonMode !== undefined) this.jsonMode = options.jsonMode;
    if (options.maxWidth !== undefined) this.maxWidth = options.maxWidth;
  }
}

// Default formatter instance
export const formatter = new OutputFormatter();

// Factory function for custom formatters
export function createFormatter(options: { 
  maxWidth?: number; 
  quiet?: boolean; 
  jsonMode?: boolean; 
} = {}): OutputFormatter {
  return new OutputFormatter(options);
}