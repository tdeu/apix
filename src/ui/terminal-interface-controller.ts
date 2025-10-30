import blessed from 'blessed';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import { StatusLineManager } from './status-line-manager';
import { HistoryManager } from './history-manager';
import { StateRenderer } from './state-renderer';
import { InputController } from './input-controller';
import { logger } from '../utils/logger';

export interface TerminalInterfaceOptions {
  enableStatusLine: boolean;
  enableEnhancedHistory: boolean;
  enableStateIndicators: boolean;
  statusLineRefreshRate: number;
  fallbackMode: boolean;
}

export interface TerminalSession {
  sessionId: string;
  startTime: Date;
  currentCommand?: string;
  currentState: 'idle' | 'planning' | 'calling-tools' | 'generating' | 'thinking';
  costAccumulated: number;
  tokensUsed: number;
  maxTokens: number;
}

/**
 * Terminal Interface Controller - Enhanced Terminal Interface 2.0
 * 
 * Orchestrates the enhanced CLI experience with real-time status line,
 * searchable history, and advanced state management.
 */
export class TerminalInterfaceController extends EventEmitter {
  private screen: blessed.Widgets.Screen | null = null;
  private statusLineManager: StatusLineManager | null = null;
  private historyManager: HistoryManager;
  private stateRenderer: StateRenderer;
  private inputController: InputController;
  
  private options: TerminalInterfaceOptions;
  private session: TerminalSession;
  private isActive: boolean = false;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(options: Partial<TerminalInterfaceOptions> = {}) {
    super();
    
    this.options = {
      enableStatusLine: true,
      enableEnhancedHistory: true,
      enableStateIndicators: true,
      statusLineRefreshRate: 300, // 300ms as specified
      fallbackMode: false,
      ...options
    };

    this.session = {
      sessionId: this.generateSessionId(),
      startTime: new Date(),
      currentState: 'idle',
      costAccumulated: 0,
      tokensUsed: 0,
      maxTokens: 8192
    };

    // Initialize managers
    this.historyManager = new HistoryManager();
    this.stateRenderer = new StateRenderer();
    this.inputController = new InputController();

    // Set up event listeners
    this.setupEventListeners();
    
    logger.internal('info', 'Terminal Interface Controller initialized', { 
      sessionId: this.session.sessionId,
      options: this.options
    });
  }

  /**
   * Initialize the enhanced terminal interface
   */
  async initialize(): Promise<void> {
    try {
      // Check terminal capabilities
      const capabilities = this.checkTerminalCapabilities();
      
      if (!capabilities.supportsAdvancedUI && !this.options.fallbackMode) {
        logger.internal('warn', 'Terminal does not support advanced UI, enabling fallback mode');
        this.options.fallbackMode = true;
      }

      if (!this.options.fallbackMode) {
        await this.initializeBlessedInterface();
      }

      if (this.options.enableStatusLine) {
        this.statusLineManager = new StatusLineManager(this.session, {
          refreshRate: this.options.statusLineRefreshRate,
          fallbackMode: this.options.fallbackMode
        });
        await this.statusLineManager.initialize();
      }

      await this.historyManager.initialize();
      await this.inputController.initialize();

      this.isActive = true;
      this.startRefreshCycle();

      this.emit('initialized');
      logger.internal('info', 'Enhanced Terminal Interface initialized successfully');

    } catch (error: any) {
      logger.error('Failed to initialize Terminal Interface', error);
      // Fall back to basic mode
      this.options.fallbackMode = true;
      await this.initializeFallbackMode();
    }
  }

  /**
   * Start the enhanced CLI session
   */
  async startSession(): Promise<void> {
    if (!this.isActive) {
      await this.initialize();
    }

    if (this.statusLineManager) {
      this.statusLineManager.start();
    }

    this.emit('session-started', this.session);
    logger.internal('info', 'Enhanced CLI session started', { sessionId: this.session.sessionId });
  }

  /**
   * Stop the enhanced CLI session
   */
  async stopSession(): Promise<void> {
    this.isActive = false;

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.statusLineManager) {
      await this.statusLineManager.stop();
    }

    if (this.screen) {
      this.screen.destroy();
      this.screen = null;
    }

    await this.historyManager.saveHistory();
    
    this.emit('session-stopped', this.session);
    logger.info('Enhanced CLI session stopped', { 
      sessionId: this.session.sessionId,
      duration: Date.now() - this.session.startTime.getTime()
    });
  }

  /**
   * Update the current AI state for visual indicators
   */
  updateState(state: TerminalSession['currentState'], details?: any): void {
    const previousState = this.session.currentState;
    this.session.currentState = state;

    if (this.stateRenderer) {
      this.stateRenderer.updateState(state, details);
    }

    if (this.statusLineManager) {
      this.statusLineManager.updateSessionData({
        currentState: state
      });
    }

    this.emit('state-changed', { previous: previousState, current: state, details });
  }

  /**
   * Update session metrics (cost, tokens, etc.)
   */
  updateSessionMetrics(metrics: Partial<Pick<TerminalSession, 'costAccumulated' | 'tokensUsed' | 'maxTokens'>>): void {
    Object.assign(this.session, metrics);

    if (this.statusLineManager) {
      this.statusLineManager.updateSessionData(metrics);
    }

    this.emit('metrics-updated', metrics);
  }

  /**
   * Add command to history
   */
  addToHistory(command: string, success: boolean = true): void {
    this.historyManager.addEntry({
      command,
      timestamp: new Date(),
      success,
      sessionId: this.session.sessionId
    });
  }

  /**
   * Start reverse search mode (Ctrl+R functionality)
   */
  async startReverseSearch(): Promise<string | null> {
    if (!this.options.enableEnhancedHistory) {
      return null;
    }

    return await this.historyManager.startReverseSearch();
  }

  /**
   * Open current input in external editor (Ctrl+G functionality)
   */
  async openInEditor(currentInput: string = ''): Promise<string | null> {
    return await this.inputController.openInEditor(currentInput);
  }

  /**
   * Check if enhanced features are available
   */
  hasEnhancedFeatures(): boolean {
    return this.isActive && !this.options.fallbackMode;
  }

  /**
   * Get current session information
   */
  getSessionInfo(): TerminalSession {
    return { ...this.session };
  }

  // Private methods

  private async initializeBlessedInterface(): Promise<void> {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'APIX AI - Enhanced Terminal Interface',
      dockBorders: true,
      fullUnicode: true,
      autoPadding: true
    });

    // Handle screen resize
    this.screen.on('resize', () => {
      this.emit('screen-resized');
    });

    // Handle key combinations
    this.screen.key(['C-c'], () => {
      this.stopSession();
      process.exit(0);
    });

    this.screen.key(['C-r'], () => {
      this.emit('reverse-search-requested');
    });

    this.screen.key(['C-g'], () => {
      this.emit('editor-requested');
    });

    logger.debug('Blessed screen interface initialized');
  }

  private async initializeFallbackMode(): Promise<void> {
    // Initialize simplified interface for terminals that don't support advanced features
    logger.info('Initializing fallback mode for basic terminal support');
    
    // Still enable history and basic features
    await this.historyManager.initialize();
    await this.inputController.initialize();
    
    this.isActive = true;
  }

  private checkTerminalCapabilities(): { supportsAdvancedUI: boolean; supportsColors: boolean } {
    const hasColors = process.stdout.isTTY && process.env.TERM !== 'dumb';
    
    // Be more conservative about advanced UI support
    // Disable blessed for now to avoid input conflicts
    const supportsAdvancedUI = false; // Temporarily disabled
    
    // Check for VS Code terminal
    const isVSCode = process.env.TERM_PROGRAM === 'vscode' || 
                     process.env.VSCODE_INJECTION === '1' ||
                     !!process.env.VSCODE_PID;

    if (isVSCode) {
      logger.internal('info', 'VS Code terminal detected - using enhanced fallback mode');
    }

    return {
      supportsAdvancedUI,
      supportsColors: hasColors
    };
  }

  private startRefreshCycle(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      if (this.isActive) {
        this.emit('refresh-cycle');
        
        if (this.statusLineManager) {
          this.statusLineManager.refresh();
        }
      }
    }, this.options.statusLineRefreshRate);
  }

  private setupEventListeners(): void {
    // Handle status line updates
    this.on('metrics-updated', (metrics) => {
      logger.debug('Session metrics updated', metrics);
    });

    this.on('state-changed', ({ previous, current, details }) => {
      logger.debug('AI state changed', { previous, current, details });
    });

    // Handle input events
    this.on('reverse-search-requested', async () => {
      const selected = await this.startReverseSearch();
      if (selected) {
        this.emit('command-selected', selected);
      }
    });

    this.on('editor-requested', async () => {
      // This will be handled by the CLI command processor
      this.emit('editor-open-requested');
    });
  }

  private generateSessionId(): string {
    return `apix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance for global access
export const terminalInterface = new TerminalInterfaceController();

export default TerminalInterfaceController;