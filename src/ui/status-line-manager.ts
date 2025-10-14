import blessed from 'blessed';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import Configstore from 'configstore';
import { logger } from '../utils/logger';
import { TerminalSession } from './terminal-interface-controller';

const execAsync = promisify(exec);

export interface StatusComponent {
  id: string;
  label: string;
  getValue: () => Promise<string> | string;
  color?: string;
  enabled: boolean;
  order: number;
  refreshRate?: number; // Override default refresh rate for this component
  command?: string; // Shell command to execute for value
}

export interface StatusLineOptions {
  refreshRate: number;
  fallbackMode: boolean;
  maxWidth?: number;
  showSeparators: boolean;
  colorTheme: 'default' | 'minimal' | 'colorful';
}

/**
 * StatusLineManager - Real-time Status Display
 * 
 * Manages the persistent status line at the bottom of the terminal
 * with customizable components and real-time updates.
 */
export class StatusLineManager {
  private session: TerminalSession;
  private options: StatusLineOptions;
  private components: Map<string, StatusComponent> = new Map();
  private config: Configstore;
  private statusBox: any | null = null;
  private isActive: boolean = false;
  private refreshInterval: NodeJS.Timeout | null = null;
  private componentCache: Map<string, { value: string; lastUpdated: number }> = new Map();

  constructor(session: TerminalSession, options: Partial<StatusLineOptions> = {}) {
    this.session = session;
    this.options = {
      refreshRate: 300,
      fallbackMode: false,
      showSeparators: true,
      colorTheme: 'default',
      ...options
    };

    this.config = new Configstore('apix-status-line', {
      components: {},
      theme: this.options.colorTheme,
      enabled: true
    });

    this.initializeDefaultComponents();
  }

  /**
   * Initialize the status line manager
   */
  async initialize(): Promise<void> {
    try {
      // Load user configuration
      await this.loadUserConfiguration();

      if (!this.options.fallbackMode) {
        await this.initializeBlessedStatusLine();
      }

      logger.internal('info', 'Status Line Manager initialized', {
        componentCount: this.components.size,
        fallbackMode: this.options.fallbackMode
      });

    } catch (error: any) {
      logger.error('Failed to initialize Status Line Manager', error);
      this.options.fallbackMode = true;
    }
  }

  /**
   * Start the status line updates
   */
  start(): void {
    // In fallback mode, never start the status line to prevent terminal spam
    if (this.options.fallbackMode) {
      logger.debug('Status line start skipped - fallback mode prevents terminal spam');
      return;
    }
    
    if (this.isActive) return;

    this.isActive = true;
    this.startRefreshCycle();

    if (!this.options.fallbackMode && this.statusBox) {
      this.statusBox.show();
    }

    logger.debug('Status line started');
  }

  /**
   * Stop the status line updates
   */
  async stop(): Promise<void> {
    this.isActive = false;

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.statusBox) {
      this.statusBox.hide();
    }

    logger.debug('Status line stopped');
  }

  /**
   * Update session data for status display
   */
  updateSessionData(data: Partial<TerminalSession>): void {
    Object.assign(this.session, data);
    // Trigger immediate refresh for session data
    this.refreshStatusLine();
  }

  /**
   * Add or update a status component
   */
  addComponent(component: StatusComponent): void {
    this.components.set(component.id, component);
    this.saveUserConfiguration();
    logger.debug('Status component added', { id: component.id, label: component.label });
  }

  /**
   * Remove a status component
   */
  removeComponent(componentId: string): void {
    this.components.delete(componentId);
    this.componentCache.delete(componentId);
    this.saveUserConfiguration();
    logger.debug('Status component removed', { id: componentId });
  }

  /**
   * Enable/disable a component
   */
  toggleComponent(componentId: string, enabled?: boolean): void {
    const component = this.components.get(componentId);
    if (component) {
      component.enabled = enabled !== undefined ? enabled : !component.enabled;
      this.saveUserConfiguration();
      logger.debug('Status component toggled', { id: componentId, enabled: component.enabled });
    }
  }

  /**
   * Get all available components
   */
  getComponents(): StatusComponent[] {
    return Array.from(this.components.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Execute shell command for status display
   */
  async executeShellCommand(command: string): Promise<string> {
    try {
      const { stdout } = await execAsync(command, { timeout: 5000 });
      return stdout.trim();
    } catch (error: any) {
      logger.warn('Shell command failed for status line', { command, error: error.message });
      return '';
    }
  }

  /**
   * Configure status line interactively
   */
  async configureInteractively(): Promise<void> {
    // This will be called by the /statusline command
    logger.info('Interactive status line configuration started');
    
    // Implementation will use inquirer for interactive configuration
    // This is a placeholder for the configuration UI
  }

  /**
   * Force refresh the status line
   */
  refresh(): void {
    if (this.isActive) {
      this.refreshStatusLine();
    }
  }

  // Private methods

  private initializeDefaultComponents(): void {
    // Project Context
    this.components.set('project', {
      id: 'project',
      label: 'Project',
      getValue: () => this.getProjectInfo(),
      color: 'cyan',
      enabled: true,
      order: 1
    });

    // Git Branch
    this.components.set('git-branch', {
      id: 'git-branch',
      label: 'Branch',
      getValue: () => this.getGitBranch(),
      color: 'green',
      enabled: true,
      order: 2,
      command: 'git rev-parse --abbrev-ref HEAD'
    });

    // Current Model
    this.components.set('model', {
      id: 'model',
      label: 'Model',
      getValue: () => 'Sonnet 4.5', // This will be dynamic based on active model
      color: 'blue',
      enabled: true,
      order: 3
    });

    // Session Cost
    this.components.set('cost', {
      id: 'cost',
      label: 'Cost',
      getValue: () => this.getSessionCost(),
      color: 'yellow',
      enabled: true,
      order: 4
    });

    // Token Usage
    this.components.set('tokens', {
      id: 'tokens',
      label: 'Tokens',
      getValue: () => this.getTokenUsage(),
      color: 'magenta',
      enabled: true,
      order: 5
    });

    // Session Duration
    this.components.set('duration', {
      id: 'duration',
      label: 'Duration',
      getValue: () => this.getSessionDuration(),
      color: 'gray',
      enabled: true,
      order: 6
    });

    // Current State
    this.components.set('state', {
      id: 'state',
      label: 'State',
      getValue: () => this.getCurrentState(),
      color: 'white',
      enabled: true,
      order: 7
    });
  }

  private async initializeBlessedStatusLine(): Promise<void> {
    // Skip blessed initialization to avoid input conflicts
    // Always use fallback mode for better compatibility
    this.options.fallbackMode = true;
    logger.debug('Using fallback mode for status line to ensure input compatibility');
    
    // In fallback mode, disable the status line entirely to prevent terminal spam
    // The status line would only show in terminal title which causes spam in logs
    this.isActive = false;
    logger.debug('Status line disabled in fallback mode to prevent terminal spam');
  }

  private startRefreshCycle(): void {
    // Don't start refresh cycle if status line is disabled
    if (!this.isActive) {
      logger.debug('Status line refresh cycle not started - status line is disabled');
      return;
    }
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      if (this.isActive) {
        this.refreshStatusLine();
      }
    }, this.options.refreshRate);

    // Immediate first refresh
    this.refreshStatusLine();
  }

  private async refreshStatusLine(): Promise<void> {
    if (!this.isActive) return;

    try {
      const statusText = await this.buildStatusText();
      
      if (this.options.fallbackMode) {
        // For fallback mode, update the terminal title or use simple console output
        this.updateTerminalTitle(statusText);
      } else if (this.statusBox) {
        this.statusBox.setContent(statusText);
        this.statusBox.screen.render();
      }

    } catch (error: any) {
      logger.error('Failed to refresh status line', error);
    }
  }

  private async buildStatusText(): Promise<string> {
    const enabledComponents = Array.from(this.components.values())
      .filter(c => c.enabled)
      .sort((a, b) => a.order - b.order);

    const componentTexts: string[] = [];

    for (const component of enabledComponents) {
      try {
        let value: string;

        // Check cache first (for performance)
        const cached = this.componentCache.get(component.id);
        const now = Date.now();
        const cacheExpiry = (component.refreshRate || this.options.refreshRate) * 2;

        if (cached && (now - cached.lastUpdated) < cacheExpiry) {
          value = cached.value;
        } else {
          // Get fresh value
          if (component.command) {
            value = await this.executeShellCommand(component.command);
          } else {
            const result = component.getValue();
            value = typeof result === 'string' ? result : await result;
          }

          // Cache the value
          this.componentCache.set(component.id, {
            value,
            lastUpdated: now
          });
        }

        if (value) {
          const colorFunc = component.color ? (chalk as any)[component.color] : chalk.white;
          const formattedValue = colorFunc(`${component.label}: ${value}`);
          componentTexts.push(formattedValue);
        }

      } catch (error: any) {
        logger.warn('Failed to get value for status component', { 
          componentId: component.id, 
          error: error.message 
        });
      }
    }

    const separator = this.options.showSeparators ? chalk.gray(' | ') : ' ';
    return componentTexts.join(separator);
  }

  private updateTerminalTitle(statusText: string): void {
    // Strip ANSI colors for terminal title
    const plainText = statusText.replace(/\u001b\[[0-9;]*m/g, '');
    
    try {
      // Update terminal title only - never print to console
      process.stdout.write(`\x1b]0;APIX AI - ${plainText}\x07`);
      
      // REMOVED: Console printing that was causing spam
      // Status line should be silent and only update terminal title
      
    } catch (error: any) {
      // Ignore title update errors silently
      logger.debug('Failed to update terminal title', error);
    }
  }

  private async loadUserConfiguration(): Promise<void> {
    try {
      const userConfig = this.config.all;
      
      if (userConfig.components) {
        // Apply user configuration to components
        for (const [id, config] of Object.entries(userConfig.components as Record<string, any>)) {
          const component = this.components.get(id);
          if (component && config) {
            Object.assign(component, config);
          }
        }
      }

      if (userConfig.theme && typeof userConfig.theme === 'string' && ['default', 'minimal', 'colorful'].includes(userConfig.theme)) {
        this.options.colorTheme = userConfig.theme as 'default' | 'minimal' | 'colorful';
      }

    } catch (error: any) {
      logger.warn('Failed to load user configuration', error);
    }
  }

  private saveUserConfiguration(): void {
    try {
      const componentConfigs: Record<string, any> = {};
      
      for (const [id, component] of this.components.entries()) {
        componentConfigs[id] = {
          enabled: component.enabled,
          order: component.order,
          color: component.color
        };
      }

      this.config.set({
        components: componentConfigs,
        theme: this.options.colorTheme,
        enabled: true
      });

    } catch (error: any) {
      logger.warn('Failed to save user configuration', error);
    }
  }

  // Component value getters

  private getProjectInfo(): string {
    const cwd = process.cwd();
    const projectName = cwd.split('/').pop() || 'unknown';
    return projectName;
  }

  private async getGitBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { timeout: 1000 });
      return stdout.trim();
    } catch {
      return 'no-git';
    }
  }

  private getSessionCost(): string {
    const cost = this.session.costAccumulated || 0;
    const rate = this.calculateBurnRate();
    return `$${cost.toFixed(4)} (${rate}/min)`;
  }

  private getTokenUsage(): string {
    const used = this.session.tokensUsed || 0;
    const max = this.session.maxTokens || 8192;
    const percentage = Math.round((used / max) * 100);
    return `${used}/${max} (${percentage}%)`;
  }

  private getSessionDuration(): string {
    const now = Date.now();
    const start = this.session.startTime.getTime();
    const duration = Math.floor((now - start) / 1000);
    
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private getCurrentState(): string {
    const stateIcons = {
      idle: '⚪',
      planning: '🧠',
      'calling-tools': '⚡',
      generating: '✍️',
      thinking: '💭'
    };

    const icon = stateIcons[this.session.currentState] || '❓';
    return `${icon} ${this.session.currentState}`;
  }

  private calculateBurnRate(): string {
    // Calculate cost per minute based on session data
    const duration = (Date.now() - this.session.startTime.getTime()) / 60000; // in minutes
    if (duration < 1) return '$0.00';
    
    const rate = this.session.costAccumulated / duration;
    return `$${rate.toFixed(4)}`;
  }
}

export default StatusLineManager;