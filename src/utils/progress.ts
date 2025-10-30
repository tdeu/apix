import ora, { Ora } from 'ora';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { logger, LogLevel } from './logger';

export interface ProgressStep {
  id: string;
  label: string;
  weight: number; // Relative weight for progress calculation
}

export interface ProgressOptions {
  showTimer?: boolean;
  showSteps?: boolean;
  compact?: boolean;
  minDuration?: number; // Only show progress for operations longer than this (ms)
  silent?: boolean;
}

/**
 * Smart Progress Manager with timing-based display rules
 * Only shows progress indicators for operations that take longer than threshold
 */
export class ProgressManager {
  private steps: ProgressStep[] = [];
  private currentStep: number = 0;
  private spinner: Ora | null = null;
  private progressBar: cliProgress.SingleBar | null = null;
  private startTime: number = Date.now();
  private stepStartTime: number = Date.now();
  private options: ProgressOptions;
  private shouldShowProgress: boolean = false;
  private progressCheckTimer: NodeJS.Timeout | null = null;
  private completed: boolean = false;

  constructor(steps: ProgressStep[], options: ProgressOptions = {}) {
    this.steps = steps;
    this.options = {
      showTimer: false,
      showSteps: false,
      compact: true,
      minDuration: 2000, // Only show progress for operations >2 seconds
      silent: logger.getLevel() === LogLevel.SILENT,
      ...options
    };
  }

  start(): void {
    this.startTime = Date.now();
    this.stepStartTime = Date.now();
    this.completed = false;
    
    // Set up delayed progress indication
    if (!this.options.silent) {
      this.progressCheckTimer = setTimeout(() => {
        if (!this.completed) {
          this.shouldShowProgress = true;
          this.initializeProgressDisplay();
        }
      }, this.options.minDuration);
    }
  }

  private initializeProgressDisplay(): void {
    if (this.options.silent || this.completed) return;

    // Use minimal single-line progress for long operations
    if (this.steps.length > 1 && !this.options.compact) {
      this.progressBar = new cliProgress.SingleBar({
        format: chalk.cyan('{bar}') + ' {percentage}% | {value}/{total}',
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true
      });
      
      this.progressBar.start(this.getTotalWeight(), 0);
    } else {
      // Use minimal spinner for long single operations
      this.spinner = ora({
        text: chalk.cyan('Processing...'),
        spinner: 'dots2'
      }).start();
    }
  }

  nextStep(success: boolean = true): void {
    if (this.currentStep < this.steps.length) {
      this.completeCurrentStep(success);
      this.currentStep++;
      
      if (this.currentStep < this.steps.length) {
        this.startCurrentStep();
      }
    }
  }

  async complete(success: boolean = true): Promise<void> {
    this.completed = true;
    
    // Clean up timer
    if (this.progressCheckTimer) {
      clearTimeout(this.progressCheckTimer);
      this.progressCheckTimer = null;
    }

    // Show minimal completion message only if progress was displayed
    if (this.shouldShowProgress && !this.options.silent) {
      if (this.spinner) {
        if (success) {
          this.spinner.succeed();
        } else {
          this.spinner.fail();
        }
        // Small delay to ensure spinner cleanup completes
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      if (this.progressBar) {
        this.progressBar.update(this.getTotalWeight());
        this.progressBar.stop();
      }

      // Show timing only in verbose mode
      if (this.options.showTimer && logger.isLevelEnabled(LogLevel.VERBOSE)) {
        const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
        console.log(chalk.gray(`Completed in ${totalTime}s`));
      }
    }
  }

  fail(error: string): void {
    this.completed = true;
    
    // Clean up timer
    if (this.progressCheckTimer) {
      clearTimeout(this.progressCheckTimer);
      this.progressCheckTimer = null;
    }

    if (this.shouldShowProgress && !this.options.silent) {
      if (this.spinner) {
        this.spinner.fail();
      }
      
      if (this.progressBar) {
        this.progressBar.stop();
      }
      
      // Show failure context only in verbose mode
      if (logger.isLevelEnabled(LogLevel.VERBOSE)) {
        this.showFailureContext();
      }
    }
  }

  updateStep(text: string): void {
    if (this.shouldShowProgress && this.spinner && !this.options.silent) {
      this.spinner.text = chalk.cyan(text);
    }
  }

  private startCurrentStep(): void {
    if (this.currentStep >= this.steps.length || !this.shouldShowProgress) return;

    const step = this.steps[this.currentStep];
    this.stepStartTime = Date.now();

    // Minimal progress indication
    if (this.progressBar) {
      // For progress bar mode, no additional output needed
      return;
    } else if (this.spinner) {
      this.spinner.text = chalk.cyan(step.label);
    }
  }

  private completeCurrentStep(success: boolean): void {
    if (!this.shouldShowProgress) return;
    
    const step = this.steps[this.currentStep];
    
    // Update progress bar without verbose output
    if (this.progressBar) {
      const completedWeight = this.getCompletedWeight();
      this.progressBar.update(completedWeight);
    }
    
    // No verbose step completion messages unless in verbose mode
    if (logger.isLevelEnabled(LogLevel.VERBOSE)) {
      const stepTime = ((Date.now() - this.stepStartTime) / 1000).toFixed(1);
      if (success) {
        console.log(chalk.green(`✓ ${step.label}`) + 
          (this.options.showTimer ? chalk.gray(` (${stepTime}s)`) : ''));
      } else {
        console.log(chalk.red(`✗ ${step.label} failed`));
      }
    }
  }

  private displaySteps(): void {
    // Only show steps in verbose mode
    if (!logger.isLevelEnabled(LogLevel.VERBOSE)) return;
    
    console.log(chalk.cyan.bold('\nProcess Steps:'));
    this.steps.forEach((step, index) => {
      console.log(chalk.gray(`  ${index + 1}. ${step.label}`));
    });
    console.log();
  }

  private getTotalWeight(): number {
    return this.steps.reduce((total, step) => total + step.weight, 0);
  }

  private getCompletedWeight(): number {
    return this.steps
      .slice(0, this.currentStep + 1)
      .reduce((total, step) => total + step.weight, 0);
  }

  private showFailureContext(): void {
    if (this.currentStep < this.steps.length) {
      const failedStep = this.steps[this.currentStep];
      console.log(chalk.red(`Failed at: ${failedStep.label}`));
      console.log(chalk.gray(`Progress: ${this.currentStep}/${this.steps.length} steps completed`));
      
      if (this.currentStep > 0) {
        console.log(chalk.green('\nCompleted steps:'));
        this.steps.slice(0, this.currentStep).forEach((step, index) => {
          console.log(chalk.green(`  ${index + 1}. ${step.label}`));
        });
      }
    }
  }
}

// Predefined step sequences for common operations
export const INTEGRATION_STEPS = {
  HTS: [
    { id: 'analyze', label: 'Analyzing project structure', weight: 1 },
    { id: 'plan', label: 'Creating integration plan', weight: 1 },
    { id: 'validate', label: 'Validating plan and dependencies', weight: 1 },
    { id: 'install', label: 'Installing dependencies', weight: 2 },
    { id: 'generate', label: 'Generating HTS components', weight: 3 },
    { id: 'configure', label: 'Updating configuration files', weight: 1 },
    { id: 'validate-final', label: 'Final validation', weight: 1 }
  ],
  
  WALLET: [
    { id: 'analyze', label: 'Analyzing project structure', weight: 1 },
    { id: 'plan', label: 'Creating wallet integration plan', weight: 1 },
    { id: 'validate', label: 'Validating plan and dependencies', weight: 1 },
    { id: 'install', label: 'Installing wallet dependencies', weight: 2 },
    { id: 'generate', label: 'Generating wallet components', weight: 3 },
    { id: 'configure', label: 'Setting up wallet configuration', weight: 1 },
    { id: 'validate-final', label: 'Final validation', weight: 1 }
  ],

  COMBINED: [
    { id: 'analyze', label: 'Analyzing project structure', weight: 1 },
    { id: 'plan', label: 'Creating combined integration plan', weight: 2 },
    { id: 'validate', label: 'Validating dependencies and conflicts', weight: 1 },
    { id: 'install', label: 'Installing all dependencies', weight: 2 },
    { id: 'generate-wallet', label: 'Generating wallet infrastructure', weight: 2 },
    { id: 'generate-hts', label: 'Generating HTS components', weight: 2 },
    { id: 'integrate', label: 'Integrating wallet + HTS functionality', weight: 3 },
    { id: 'configure', label: 'Updating configuration files', weight: 1 },
    { id: 'validate-final', label: 'Final validation and testing', weight: 1 }
  ],

  ANALYSIS: [
    { id: 'scan', label: 'Scanning project files', weight: 2 },
    { id: 'detect', label: 'Detecting framework and dependencies', weight: 1 },
    { id: 'analyze', label: 'Analyzing integration opportunities', weight: 1 },
    { id: 'recommend', label: 'Generating recommendations', weight: 1 }
  ]
};

// Enhanced spinner configurations
export const SPINNER_STYLES = {
  default: 'dots2',
  fast: 'dots',
  slow: 'moon',
  arrows: 'arrow3',
  bounce: 'bounce'
};

// Utility functions for common progress patterns
export function createProgressManager(operation: keyof typeof INTEGRATION_STEPS, options?: ProgressOptions): ProgressManager {
  return new ProgressManager(INTEGRATION_STEPS[operation], options);
}

export function withProgress<T>(
  steps: ProgressStep[],
  operation: () => Promise<T>,
  options?: ProgressOptions
): Promise<T> {
  const progress = new ProgressManager(steps, options);
  
  return new Promise(async (resolve, reject) => {
    try {
      progress.start();
      const result = await operation();
      await progress.complete(true);
      resolve(result);
    } catch (error) {
      progress.fail(error instanceof Error ? error.message : 'Unknown error');
      reject(error);
    }
  });
}

export function trackSteps<T>(
  steps: ProgressStep[],
  operations: (() => Promise<any>)[],
  options?: ProgressOptions
): Promise<T[]> {
  const progress = new ProgressManager(steps, {
    compact: true,
    minDuration: 1500, // Show progress for operations >1.5s
    ...options
  });
  
  return new Promise(async (resolve, reject) => {
    const results: any[] = [];
    
    try {
      progress.start();
      
      for (let i = 0; i < operations.length; i++) {
        try {
          const result = await operations[i]();
          results.push(result);
          progress.nextStep(true);
        } catch (stepError) {
          progress.nextStep(false);
          throw stepError;
        }
      }
      
      await progress.complete(true);
      resolve(results);
    } catch (error) {
      progress.fail(error instanceof Error ? error.message : 'Unknown error');
      reject(error);
    }
  });
}

/**
 * Smart progress wrapper for single operations
 * Only shows progress if operation takes longer than threshold
 */
export async function withSmartProgress<T>(
  operation: () => Promise<T>,
  label: string = 'Processing',
  options: { minDuration?: number; silent?: boolean } = {}
): Promise<T> {
  const startTime = Date.now();
  const minDuration = options.minDuration || 2000;
  let spinner: Ora | null = null;
  let showedProgress = false;

  // Set up delayed progress indication
  const progressTimer = setTimeout(() => {
    if (!options.silent && logger.getLevel() > LogLevel.SILENT) {
      const newSpinner = ora(chalk.cyan(label)).start();
      spinner = newSpinner;
      showedProgress = true;
    }
  }, minDuration);

  try {
    const result = await operation();
    
    // Clean up
    clearTimeout(progressTimer);
    if (spinner) {
      (spinner as Ora).succeed();
    }
    
    return result;
  } catch (error) {
    clearTimeout(progressTimer);
    if (spinner) {
      (spinner as Ora).fail();
    }
    throw error;
  }
}

/**
 * Minimal progress for quick operations
 * Shows working indicator immediately but with minimal visual impact
 */
export async function withMinimalProgress<T>(
  operation: () => Promise<T>,
  label?: string
): Promise<T> {
  if (logger.getLevel() === LogLevel.SILENT) {
    return operation();
  }

  const startTime = Date.now();
  if (label && logger.isLevelEnabled(LogLevel.VERBOSE)) {
    console.log(chalk.cyan('◦'), label);
  }

  try {
    const result = await operation();
    const duration = Date.now() - startTime;
    
    // Show completion only if it took a noticeable amount of time
    if (duration > 1000 && label && logger.isLevelEnabled(LogLevel.VERBOSE)) {
      console.log(chalk.green('✓'), `${label} completed`);
    }
    
    return result;
  } catch (error) {
    if (label && logger.isLevelEnabled(LogLevel.VERBOSE)) {
      console.log(chalk.red('✗'), `${label} failed`);
    }
    throw error;
  }
}