import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import Fuzzysort from 'fuzzysort';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { logger } from '../utils/logger';

export interface HistoryEntry {
  command: string;
  timestamp: Date;
  success: boolean;
  sessionId: string;
  duration?: number;
  context?: string;
}

export interface HistorySearchOptions {
  limit: number;
  includeFailures: boolean;
  fuzzyThreshold: number;
  sessionFilter?: string;
}

/**
 * HistoryManager - Enhanced Command History
 * 
 * Manages searchable command history with fuzzy search capabilities
 * and interactive Ctrl+R reverse search functionality.
 */
export class HistoryManager {
  private historyFile: string;
  private history: HistoryEntry[] = [];
  private maxHistorySize: number = 10000;
  private searchOptions: HistorySearchOptions;

  constructor() {
    this.historyFile = path.join(os.homedir(), '.apix', 'command-history.json');
    this.searchOptions = {
      limit: 50,
      includeFailures: false,
      fuzzyThreshold: -1000,
      sessionFilter: undefined
    };
  }

  /**
   * Initialize the history manager
   */
  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.historyFile));
      await this.loadHistory();
      
      logger.internal('info', 'History Manager initialized', { 
        historyCount: this.history.length,
        historyFile: this.historyFile
      });

    } catch (error: any) {
      logger.error('Failed to initialize History Manager', error);
      // Continue with empty history
      this.history = [];
    }
  }

  /**
   * Add a new entry to history
   */
  addEntry(entry: HistoryEntry): void {
    // Avoid duplicate consecutive entries
    if (this.history.length > 0) {
      const lastEntry = this.history[this.history.length - 1];
      if (lastEntry.command === entry.command && 
          Date.now() - lastEntry.timestamp.getTime() < 5000) {
        return; // Skip duplicate within 5 seconds
      }
    }

    this.history.push(entry);

    // Trim history if it exceeds max size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    // Save asynchronously
    this.saveHistory().catch(error => {
      logger.warn('Failed to save history', error);
    });

    logger.debug('History entry added', { 
      command: entry.command.substring(0, 50) + '...',
      success: entry.success
    });
  }

  /**
   * Search history with fuzzy matching
   */
  searchHistory(query: string, options?: Partial<HistorySearchOptions>): HistoryEntry[] {
    const searchOpts = { ...this.searchOptions, ...options };
    
    let candidates = this.history;

    // Filter by success if needed
    if (!searchOpts.includeFailures) {
      candidates = candidates.filter(entry => entry.success);
    }

    // Filter by session if specified
    if (searchOpts.sessionFilter) {
      candidates = candidates.filter(entry => entry.sessionId === searchOpts.sessionFilter);
    }

    if (!query.trim()) {
      return candidates.slice(-searchOpts.limit).reverse();
    }

    // Perform fuzzy search on commands
    const results = Fuzzysort.go(query, candidates, {
      key: 'command',
      limit: searchOpts.limit,
      threshold: searchOpts.fuzzyThreshold
    });

    return results.map(result => result.obj);
  }

  /**
   * Start interactive reverse search (Ctrl+R functionality)
   */
  async startReverseSearch(): Promise<string | null> {
    try {
      console.log(chalk.blue('\n🔍 Reverse Search Mode (type to search, Ctrl+C to cancel)'));
      console.log(chalk.gray('Start typing to find previous commands...\n'));

      const { searchQuery } = await inquirer.prompt([{
        type: 'input',
        name: 'searchQuery',
        message: 'Search:',
        prefix: chalk.cyan('(reverse-i-search)'),
        transformer: (input: string) => {
          // Show live search results as user types
          if (input.length >= 2) {
            const results = this.searchHistory(input, { limit: 5 });
            if (results.length > 0) {
              const preview = results[0].command;
              return `${input} ${chalk.gray('→')} ${chalk.yellow(preview.substring(0, 50))}`;
            }
          }
          return input;
        }
      }]);

      if (!searchQuery) {
        return null;
      }

      const results = this.searchHistory(searchQuery, { limit: 10 });
      
      if (results.length === 0) {
        console.log(chalk.yellow('No matching commands found.'));
        return null;
      }

      // Show selection menu
      const choices = results.map((entry, index) => ({
        name: this.formatHistoryEntry(entry, searchQuery),
        value: entry.command,
        short: entry.command.substring(0, 50) + (entry.command.length > 50 ? '...' : '')
      }));

      const { selectedCommand } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedCommand',
        message: 'Select command:',
        choices,
        pageSize: Math.min(10, choices.length)
      }]);

      return selectedCommand;

    } catch (error: any) {
      if (error.name === 'ExitPromptError') {
        console.log(chalk.gray('\nReverse search cancelled.'));
        return null;
      }
      throw error;
    }
  }

  /**
   * Get recent commands
   */
  getRecentCommands(limit: number = 20): HistoryEntry[] {
    return this.history.slice(-limit).reverse();
  }

  /**
   * Get command statistics
   */
  getStatistics(): {
    totalCommands: number;
    successRate: number;
    mostUsedCommands: Array<{ command: string; count: number }>;
    averageSessionLength: number;
  } {
    const totalCommands = this.history.length;
    const successfulCommands = this.history.filter(entry => entry.success).length;
    const successRate = totalCommands > 0 ? (successfulCommands / totalCommands) * 100 : 0;

    // Count command frequency
    const commandCounts = new Map<string, number>();
    this.history.forEach(entry => {
      const baseCommand = entry.command.split(' ')[0]; // Get base command
      commandCounts.set(baseCommand, (commandCounts.get(baseCommand) || 0) + 1);
    });

    const mostUsedCommands = Array.from(commandCounts.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate average session length
    const sessions = new Map<string, HistoryEntry[]>();
    this.history.forEach(entry => {
      if (!sessions.has(entry.sessionId)) {
        sessions.set(entry.sessionId, []);
      }
      sessions.get(entry.sessionId)!.push(entry);
    });

    const sessionLengths = Array.from(sessions.values()).map(entries => entries.length);
    const averageSessionLength = sessionLengths.length > 0 ? 
      sessionLengths.reduce((sum, length) => sum + length, 0) / sessionLengths.length : 0;

    return {
      totalCommands,
      successRate,
      mostUsedCommands,
      averageSessionLength
    };
  }

  /**
   * Clear history
   */
  async clearHistory(): Promise<void> {
    this.history = [];
    await this.saveHistory();
    logger.info('Command history cleared');
  }

  /**
   * Export history
   */
  async exportHistory(filePath: string): Promise<void> {
    await fs.writeJSON(filePath, this.history, { spaces: 2 });
    logger.info('History exported', { filePath, entryCount: this.history.length });
  }

  /**
   * Save history to disk
   */
  async saveHistory(): Promise<void> {
    try {
      await fs.writeJSON(this.historyFile, this.history, { spaces: 2 });
    } catch (error: any) {
      logger.error('Failed to save history', error);
    }
  }

  // Private methods

  private async loadHistory(): Promise<void> {
    try {
      if (await fs.pathExists(this.historyFile)) {
        const data = await fs.readJSON(this.historyFile);
        
        // Validate and convert dates
        this.history = data.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        })).filter((entry: any) => entry.command && entry.timestamp);

        logger.debug('History loaded', { entryCount: this.history.length });
      }
    } catch (error: any) {
      logger.warn('Failed to load history file, starting with empty history', error);
      this.history = [];
    }
  }

  private formatHistoryEntry(entry: HistoryEntry, highlightQuery: string): string {
    const timeAgo = this.getTimeAgo(entry.timestamp);
    const successIcon = entry.success ? chalk.green('✓') : chalk.red('✗');
    
    let command = entry.command;
    
    // Highlight matching parts if query provided
    if (highlightQuery) {
      const result = Fuzzysort.single(highlightQuery, command);
      if (result) {
        // Simple highlighting by wrapping matching part in yellow
        const index = command.toLowerCase().indexOf(highlightQuery.toLowerCase());
        if (index !== -1) {
          const before = command.slice(0, index);
          const match = command.slice(index, index + highlightQuery.length);
          const after = command.slice(index + highlightQuery.length);
          command = before + chalk.yellow(match) + after;
        }
      }
    }

    return `${successIcon} ${command} ${chalk.gray(`(${timeAgo})`)}`;
  }

  private getTimeAgo(timestamp: Date): string {
    const now = Date.now();
    const diff = now - timestamp.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }
}

export default HistoryManager;