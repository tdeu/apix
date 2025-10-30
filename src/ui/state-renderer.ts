import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { logger } from '../utils/logger';

export type AIState = 'idle' | 'planning' | 'calling-tools' | 'generating' | 'thinking';

export interface StateDetails {
  step?: string;
  progress?: number;
  totalSteps?: number;
  currentTool?: string;
  thinkingMessage?: string;
  estimatedTime?: number;
}

export interface StateIndicatorOptions {
  showProgress: boolean;
  showEstimatedTime: boolean;
  verboseMode: boolean;
  thinkingMode: boolean;
  colorTheme: 'default' | 'minimal' | 'colorful';
}

/**
 * StateRenderer - Visual State Indicators
 * 
 * Provides clear visual feedback about AI's internal state with
 * toggleable thinking mode and enhanced progress indicators.
 */
export class StateRenderer {
  private currentState: AIState = 'idle';
  private currentSpinner: Ora | null = null;
  private options: StateIndicatorOptions;
  private stateStartTime: number = 0;
  private thinkingMessages: string[] = [];

  constructor(options: Partial<StateIndicatorOptions> = {}) {
    this.options = {
      showProgress: true,
      showEstimatedTime: true,
      verboseMode: false,
      thinkingMode: false,
      colorTheme: 'default',
      ...options
    };
  }

  /**
   * Update the current AI state
   */
  updateState(state: AIState, details?: StateDetails): void {
    const previousState = this.currentState;
    this.currentState = state;
    this.stateStartTime = Date.now();

    // Stop previous spinner
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }

    // Only start spinner for active states, not idle
    if (state !== 'idle') {
      this.startStateIndicator(state, details);
    }

    // Log thinking messages if in thinking mode
    if (this.options.thinkingMode && details?.thinkingMessage) {
      this.addThinkingMessage(details.thinkingMessage);
    }

    logger.debug('AI state updated', { 
      previous: previousState, 
      current: state, 
      details 
    });
  }

  /**
   * Toggle thinking mode on/off
   */
  toggleThinkingMode(enabled?: boolean): boolean {
    this.options.thinkingMode = enabled !== undefined ? enabled : !this.options.thinkingMode;
    
    const status = this.options.thinkingMode ? 'enabled' : 'disabled';
    console.log(chalk.blue(`\n🧠 Thinking mode ${status}`));
    
    if (this.options.thinkingMode) {
      console.log(chalk.gray('AI reasoning and internal monologue will be displayed.'));
    } else {
      console.log(chalk.gray('Only final outputs will be shown.'));
    }

    return this.options.thinkingMode;
  }

  /**
   * Set verbose mode
   */
  setVerboseMode(enabled: boolean): void {
    this.options.verboseMode = enabled;
  }

  /**
   * Add a thinking message (used in thinking mode)
   */
  addThinkingMessage(message: string): void {
    if (!this.options.thinkingMode) return;

    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = chalk.dim(`[${timestamp}] 💭 ${message}`);
    
    console.log(formattedMessage);
    this.thinkingMessages.push(message);

    // Keep only recent messages
    if (this.thinkingMessages.length > 50) {
      this.thinkingMessages = this.thinkingMessages.slice(-50);
    }
  }

  /**
   * Update progress for current state
   */
  updateProgress(progress: number, total?: number, message?: string): void {
    if (!this.options.showProgress) return;

    if (this.currentSpinner) {
      let progressText = '';
      
      if (total) {
        const percentage = Math.round((progress / total) * 100);
        progressText = ` (${progress}/${total} - ${percentage}%)`;
      } else {
        progressText = ` (${progress})`;
      }

      const fullText = `${this.getStateDescription(this.currentState)}${progressText}`;
      if (message) {
        this.currentSpinner.text = `${fullText} - ${message}`;
      } else {
        this.currentSpinner.text = fullText;
      }
    }
  }

  /**
   * Show completion status
   */
  showCompletion(success: boolean, message?: string): void {
    if (this.currentSpinner) {
      if (success) {
        this.currentSpinner.succeed(chalk.green(`✅ ${message || 'Operation completed successfully'}`));
      } else {
        this.currentSpinner.fail(chalk.red(`❌ ${message || 'Operation failed'}`));
      }
      this.currentSpinner = null;
    }

    // Show timing if enabled
    if (this.options.showEstimatedTime && this.stateStartTime > 0) {
      const duration = ((Date.now() - this.stateStartTime) / 1000).toFixed(1);
      console.log(chalk.gray(`⏱️  Duration: ${duration}s`));
    }

    this.currentState = 'idle';
  }

  /**
   * Show error state
   */
  showError(error: string | Error, details?: any): void {
    if (this.currentSpinner) {
      this.currentSpinner.fail();
      this.currentSpinner = null;
    }

    const errorMessage = error instanceof Error ? error.message : error;
    console.log(chalk.red(`\n❌ Error: ${errorMessage}`));
    
    if (this.options.verboseMode && details) {
      console.log(chalk.gray('Error details:'));
      console.log(chalk.gray(JSON.stringify(details, null, 2)));
    }

    this.currentState = 'idle';
  }

  /**
   * Clear current state
   */
  clearState(): void {
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }
    this.currentState = 'idle';
  }

  /**
   * Get current state information
   */
  getCurrentState(): { state: AIState; duration: number; thinkingMode: boolean } {
    return {
      state: this.currentState,
      duration: this.stateStartTime > 0 ? Date.now() - this.stateStartTime : 0,
      thinkingMode: this.options.thinkingMode
    };
  }

  /**
   * Get recent thinking messages
   */
  getThinkingMessages(): string[] {
    return [...this.thinkingMessages];
  }

  // Private methods

  private startStateIndicator(state: AIState, details?: StateDetails): void {
    const stateConfig = this.getStateConfig(state);
    let spinnerText = this.getStateDescription(state);

    // Add details to spinner text
    if (details?.step) {
      spinnerText += ` - ${details.step}`;
    }

    if (details?.currentTool) {
      spinnerText += ` (${details.currentTool})`;
    }

    // Create spinner with appropriate style
    this.currentSpinner = ora({
      text: spinnerText,
      spinner: stateConfig.spinner,
      color: stateConfig.color
    }).start();

    // Show estimated time if available
    if (this.options.showEstimatedTime && details?.estimatedTime) {
      const minutes = Math.ceil(details.estimatedTime / 60);
      console.log(chalk.gray(`⏱️  Estimated time: ~${minutes} minute${minutes !== 1 ? 's' : ''}`));
    }

    // Show thinking message immediately if provided
    if (this.options.thinkingMode && details?.thinkingMessage) {
      this.addThinkingMessage(details.thinkingMessage);
    }
  }

  private getStateConfig(state: AIState): { spinner: any; color: any } {
    const configs = {
      idle: { spinner: 'dots', color: 'gray' },
      planning: { spinner: 'dots2', color: 'blue' },
      'calling-tools': { spinner: 'arrow3', color: 'yellow' },
      generating: { spinner: 'moon', color: 'green' },
      thinking: { spinner: 'bouncingBall', color: 'magenta' }
    };

    return configs[state] || configs.idle;
  }

  private getStateDescription(state: AIState): string {
    const descriptions = {
      idle: '⚪ Ready',
      planning: '🧠 Planning approach...',
      'calling-tools': '⚡ Executing operations...',
      generating: '✍️ Generating response...',
      thinking: '💭 Deep thinking...'
    };

    const description = descriptions[state] || '❓ Processing...';

    // Add color theme styling
    switch (this.options.colorTheme) {
      case 'minimal':
        return chalk.white(description);
      case 'colorful':
        return this.applyColorfulTheme(state, description);
      default:
        return description;
    }
  }

  private applyColorfulTheme(state: AIState, description: string): string {
    const colorMap = {
      idle: chalk.gray,
      planning: chalk.blue,
      'calling-tools': chalk.yellow,
      generating: chalk.green,
      thinking: chalk.magenta
    };

    const colorFunc = colorMap[state] || chalk.white;
    return colorFunc(description);
  }
}

export default StateRenderer;