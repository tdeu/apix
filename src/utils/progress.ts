import ora, { Ora } from 'ora';
import chalk from 'chalk';
import cliProgress from 'cli-progress';

export interface ProgressStep {
  id: string;
  label: string;
  weight: number; // Relative weight for progress calculation
}

export interface ProgressOptions {
  showTimer?: boolean;
  showSteps?: boolean;
  compact?: boolean;
}

export class ProgressManager {
  private steps: ProgressStep[] = [];
  private currentStep: number = 0;
  private spinner: Ora | null = null;
  private progressBar: cliProgress.SingleBar | null = null;
  private startTime: number = Date.now();
  private stepStartTime: number = Date.now();
  private options: ProgressOptions;

  constructor(steps: ProgressStep[], options: ProgressOptions = {}) {
    this.steps = steps;
    this.options = {
      showTimer: true,
      showSteps: true,
      compact: false,
      ...options
    };
  }

  start(): void {
    this.startTime = Date.now();
    this.stepStartTime = Date.now();
    
    if (this.options.showSteps) {
      this.displaySteps();
    }

    if (!this.options.compact) {
      this.progressBar = new cliProgress.SingleBar({
        format: chalk.cyan('{bar}') + ' {percentage}% | ETA: {eta}s | {value}/{total} steps',
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true
      });
      
      this.progressBar.start(this.getTotalWeight(), 0);
    }

    this.startCurrentStep();
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

  complete(success: boolean = true): void {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(chalk.green('✅ All steps completed successfully!'));
      } else {
        this.spinner.fail(chalk.red('❌ Process failed'));
      }
    }

    if (this.progressBar) {
      this.progressBar.update(this.getTotalWeight());
      this.progressBar.stop();
    }

    if (this.options.showTimer) {
      const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
      console.log(chalk.gray(`⏱️  Total time: ${totalTime}s`));
    }
  }

  fail(error: string): void {
    if (this.spinner) {
      this.spinner.fail(chalk.red(`❌ ${error}`));
    }
    
    if (this.progressBar) {
      this.progressBar.stop();
    }
    
    this.showFailureContext();
  }

  updateSpinner(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  private startCurrentStep(): void {
    if (this.currentStep >= this.steps.length) return;

    const step = this.steps[this.currentStep];
    this.stepStartTime = Date.now();

    if (this.options.compact) {
      this.spinner = ora({
        text: step.label,
        spinner: 'dots2'
      }).start();
    } else {
      this.spinner = ora({
        text: `${step.label} (${this.currentStep + 1}/${this.steps.length})`,
        spinner: 'dots2'
      }).start();
    }
  }

  private completeCurrentStep(success: boolean): void {
    if (!this.spinner) return;
    
    const step = this.steps[this.currentStep];
    const stepTime = ((Date.now() - this.stepStartTime) / 1000).toFixed(1);
    
    if (success) {
      this.spinner.succeed(chalk.green(`✅ ${step.label}`) + 
        (this.options.showTimer ? chalk.gray(` (${stepTime}s)`) : ''));
    } else {
      this.spinner.fail(chalk.red(`❌ ${step.label} failed`));
    }

    // Update progress bar
    if (this.progressBar) {
      const completedWeight = this.getCompletedWeight();
      this.progressBar.update(completedWeight);
    }
  }

  private displaySteps(): void {
    console.log(chalk.cyan.bold('\n📋 Process Steps:'));
    this.steps.forEach((step, index) => {
      console.log(chalk.gray(`   ${index + 1}. ${step.label}`));
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
      console.log(chalk.red(`\n❌ Failed at step: ${failedStep.label}`));
      console.log(chalk.yellow(`📍 Progress: ${this.currentStep}/${this.steps.length} steps completed`));
      
      if (this.currentStep > 0) {
        console.log(chalk.green('\n✅ Completed steps:'));
        this.steps.slice(0, this.currentStep).forEach((step, index) => {
          console.log(chalk.green(`   ${index + 1}. ${step.label}`));
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
      progress.complete(true);
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
  const progress = new ProgressManager(steps, options);
  
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
      
      progress.complete(true);
      resolve(results);
    } catch (error) {
      progress.fail(error instanceof Error ? error.message : 'Unknown error');
      reject(error);
    }
  });
}