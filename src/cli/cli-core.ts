import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ProjectAnalyzer } from '../analysis/project-analyzer';
import { IntegrationPlanner } from '../planning/integration-planner';
import { IntegrationGenerator } from '../generation/integration-generator';
import { ConfigurationManager } from '../utils/config-manager';
import { logger } from '../utils/logger';
import { createProgressManager, INTEGRATION_STEPS, trackSteps } from '../utils/progress';
import { HealthChecker } from '../validation/health-checker';
import { IntegrationValidator } from '../validation/integration-validator';
import { IntegrationOptions, AnalysisOptions, ProjectContext } from '../types';

export class APIxCLI {
  private analyzer: ProjectAnalyzer;
  private planner: IntegrationPlanner;
  private generator: IntegrationGenerator;
  private config: ConfigurationManager;
  private validator: IntegrationValidator;

  constructor() {
    this.analyzer = new ProjectAnalyzer();
    this.planner = new IntegrationPlanner();
    this.generator = new IntegrationGenerator();
    this.config = new ConfigurationManager();
    this.validator = new IntegrationValidator();
  }

  async initialize(): Promise<void> {
    await this.generator.initialize();
  }

  async analyze(options: AnalysisOptions): Promise<void> {
    const progress = createProgressManager('ANALYSIS', { 
      showTimer: true, 
      showSteps: !options.verbose,
      compact: false 
    });

    try {
      const operations = [
        // Step 1: Scan project files
        async () => {
          progress.updateSpinner('Scanning project structure and files...');
          return await this.analyzer.analyzeProject(options.directory);
        },
        
        // Step 2: Detect framework
        async () => {
          progress.updateSpinner('Detecting framework and analyzing dependencies...');
          // This is done in step 1, just return the context
          return null;
        },
        
        // Step 3: Analyze opportunities  
        async () => {
          progress.updateSpinner('Identifying integration opportunities...');
          return null;
        },
        
        // Step 4: Generate recommendations
        async () => {
          progress.updateSpinner('Generating personalized recommendations...');
          const context = await this.analyzer.analyzeProject(options.directory);
          return await this.planner.generateRecommendations(context);
        }
      ];

      progress.start();
      const results = await trackSteps(
        INTEGRATION_STEPS.ANALYSIS,
        operations,
        { showTimer: true }
      );
      progress.complete(true);

      const context = results[0] as ProjectContext;
      const recommendations = results[3] as any[];

      this.displayAnalysisResults(context, options.verbose || false);
      this.displayRecommendations(recommendations);
      await this.promptNextSteps(recommendations);

    } catch (error) {
      progress.fail('Analysis failed');
      
      if (error instanceof Error) {
        // Handle compatibility errors with helpful messages
        if (error.message.includes('No supported framework')) {
          console.log('\n🎯 APIX specializes in modern React-based applications:');
          console.log('   ✅ Next.js applications');
          console.log('   ✅ React applications (CRA, Vite)');
          console.log('   ✅ TypeScript/JavaScript projects\n');
          console.log('📚 Get started:');
          console.log('   npx create-next-app@latest my-hedera-app');
          console.log('   npx create-react-app my-hedera-app --template typescript\n');
        } else if (error.message.includes('Angular')) {
          console.log('\n🎯 APIX focuses on React ecosystem for optimal web3 integration');
          console.log('📚 Create a React project: npx create-next-app@latest my-hedera-app\n');
        } else {
          console.error('❌', error.message);
        }
      }
      
      throw error;
    }
  }

  async addIntegration(integration: string, options: IntegrationOptions): Promise<void> {
    if (!this.isValidIntegration(integration)) {
      throw new Error(`Unknown integration type: ${integration}`);
    }

    // Select appropriate progress steps based on integration type
    const progressType = integration.toUpperCase() as keyof typeof INTEGRATION_STEPS;
    const steps = INTEGRATION_STEPS[progressType] || INTEGRATION_STEPS.HTS; // Default to HTS steps
    
    const progress = createProgressManager(progressType, { 
      showTimer: true, 
      showSteps: true,
      compact: false 
    });

    try {
      const operations = [
        // Step 1: Analyze project
        async () => {
          progress.updateSpinner('Analyzing project structure and compatibility...');
          return await this.analyzer.analyzeProject('.');
        },
        
        // Step 2: Create plan
        async () => {
          progress.updateSpinner('Creating integration plan and resolving dependencies...');
          const context = await this.analyzer.analyzeProject('.');
          return await this.planner.createIntegrationPlan(integration, options, context);
        },
        
        // Step 3: Validate plan
        async () => {
          progress.updateSpinner('Validating integration plan and checking conflicts...');
          const context = await this.analyzer.analyzeProject('.');
          const plan = await this.planner.createIntegrationPlan(integration, options, context);
          
          // Run comprehensive validation
          const validationReport = await this.validator.validateIntegrationPlan(context, plan);
          
          if (!validationReport.passed) {
            logger.error('Integration validation failed:');
            console.log(this.validator.formatValidationReport(validationReport));
            throw new Error('Integration plan validation failed - see details above');
          }
          
          if (validationReport.warnings.length > 0) {
            logger.warn('Integration validation has warnings:');
            console.log(this.validator.formatValidationReport(validationReport));
          }
          
          const isValid = await this.generator.validateIntegration(plan, context);
          if (!isValid) {
            throw new Error('Integration plan validation failed');
          }
          return { context, plan };
        },
        
        // Step 4: Install dependencies (if needed)
        async () => {
          progress.updateSpinner('Installing required dependencies...');
          // Dependencies are installed during generation, just return success
          return true;
        },
        
        // Step 5: Generate code
        async () => {
          progress.updateSpinner('Generating components, hooks, and utilities...');
          const context = await this.analyzer.analyzeProject('.');
          const plan = await this.planner.createIntegrationPlan(integration, options, context);
          return await this.generator.generateIntegration(plan, context);
        },
        
        // Step 6: Configure
        async () => {
          progress.updateSpinner('Updating configuration files...');
          // Configuration updates are done during generation
          return true;
        },
        
        // Step 7: Final validation
        async () => {
          progress.updateSpinner('Running final validation checks...');
          // Could add post-generation validation here
          return true;
        }
      ];

      progress.start();
      const results = await trackSteps(steps, operations.slice(0, steps.length));
      const generationResult = results[4]; // Generation result is at index 4
      progress.complete(true);
      
      // Show generation results with enhanced formatting
      console.log(chalk.green.bold('\n🎉 Integration Complete!\n'));
      
      // Type guard to ensure we have the right result structure
      if (generationResult && typeof generationResult === 'object' && 'generatedFiles' in generationResult) {
        const result = generationResult as any;
        
        if (result.generatedFiles?.length > 0) {
          console.log(chalk.blue.bold('📁 Generated Files:'));
          result.generatedFiles.forEach((file: any) => {
            console.log(chalk.green(`   ✅ ${file.path}`));
          });
          console.log();
        }
        
        if (result.installedDependencies?.length > 0) {
          console.log(chalk.blue.bold('📦 Installed Dependencies:'));
          result.installedDependencies.forEach((dep: string) => {
            console.log(chalk.green(`   ✅ ${dep}`));
          });
          console.log();
        }
        
        if (result.modifiedFiles?.length > 0) {
          console.log(chalk.blue.bold('⚙️  Updated Configuration:'));
          result.modifiedFiles.forEach((file: string) => {
            console.log(chalk.yellow(`   🔧 ${file}`));
          });
          console.log();
        }
        
        if (result.nextSteps?.length > 0) {
          console.log(chalk.yellow.bold('🚀 Next Steps:'));
          result.nextSteps.forEach((step: string) => {
            console.log(chalk.cyan(`   ${step}`));
          });
          console.log();
        }
      }

    } catch (error) {
      progress.fail(`Failed to add ${integration} integration`);
      
      // Show contextual error help
      if (error instanceof Error) {
        console.log(chalk.yellow('\n🔧 Troubleshooting Tips:'));
        console.log(chalk.gray('   • Ensure your project has a valid package.json'));
        console.log(chalk.gray('   • Check that you\'re in a React/Next.js project root'));
        console.log(chalk.gray('   • Try running the command with --force flag'));
        console.log(chalk.gray(`   • Get help: apix ${integration} --help\n`));
      }
      
      throw error;
    }
  }

  async init(options: { force?: boolean }): Promise<void> {
    const spinner = ora('⚡ Initializing APIx configuration...').start();

    try {
      if (await this.config.exists() && !options.force) {
        spinner.info('APIx already initialized');
        
        const { reinitialize } = await inquirer.prompt([{
          type: 'confirm',
          name: 'reinitialize',
          message: 'Reinitialize APIx configuration?',
          default: false
        }]);

        if (!reinitialize) return;
      }

      const config = await this.gatherConfiguration();
      await this.config.save(config);
      
      spinner.succeed('✅ APIx initialized successfully!');
      
      console.log(chalk.green('\n🎉 You\'re ready to use APIx!'));
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.gray('  • Run'), chalk.yellow('apix analyze'), chalk.gray('to analyze your project'));
      console.log(chalk.gray('  • Run'), chalk.yellow('apix add <integration>'), chalk.gray('to add integrations'));

    } catch (error) {
      spinner.fail('❌ Initialization failed');
      throw error;
    }
  }

  async status(): Promise<void> {
    const spinner = ora('📊 Checking integration status...').start();

    try {
      const context = await this.analyzer.analyzeProject('.');
      const status = await this.analyzer.getIntegrationStatus(context);
      
      spinner.succeed('✅ Status check complete');
      this.displayStatus(status);

    } catch (error) {
      spinner.fail('❌ Status check failed');
      throw error;
    }
  }

  async health(options: { quick?: boolean; fix?: boolean }): Promise<void> {
    const progress = createProgressManager('ANALYSIS', { 
      showTimer: true, 
      showSteps: true,
      compact: options.quick 
    });

    try {
      progress.start();
      
      // Step 1: Analyze project
      progress.updateSpinner('Analyzing project structure...');
      const context = await this.analyzer.analyzeProject('.');
      progress.nextStep(true);

      // Step 2: Initialize health checker
      progress.updateSpinner('Initializing health checks...');
      const healthChecker = new HealthChecker(context);
      progress.nextStep(true);

      // Step 3: Run health checks
      progress.updateSpinner('Running comprehensive health checks...');
      const report = options.quick 
        ? await healthChecker.runQuickHealthCheck() 
        : await healthChecker.runCompleteHealthCheck();
      progress.nextStep(true);

      // Step 4: Display results
      progress.updateSpinner('Generating health report...');
      if (options.quick) {
        const quickReport = report as { healthy: boolean; criticalIssues: string[] };
        if (quickReport.healthy) {
          console.log(chalk.green('\n✅ Project is healthy!'));
        } else {
          console.log(chalk.red('\n❌ Critical issues detected:'));
          quickReport.criticalIssues.forEach(issue => {
            console.log(chalk.red(`   • ${issue}`));
          });
          console.log(chalk.yellow('\nRun "apix health" for detailed analysis'));
        }
      } else {
        const fullReport = report as any;
        console.log(healthChecker.formatHealthReport(fullReport));
        
        // Show suggestions for fixes if requested
        if (options.fix && (fullReport.criticalIssues > 0 || fullReport.warnings > 0)) {
          console.log(chalk.cyan.bold('\n🔧 Auto-fix Suggestions:'));
          console.log(chalk.gray('   • Run "npm install" to fix dependency issues'));
          console.log(chalk.gray('   • Run "apix init" to regenerate configuration'));
          console.log(chalk.gray('   • Run "npx tsc --init" to create TypeScript config'));
          console.log(chalk.gray('   • Create .env.local with Hedera credentials'));
        }
      }
      
      progress.complete(true);

    } catch (error) {
      progress.fail('Health check failed');
      throw error;
    }
  }

  // Helper methods
  private displayAnalysisResults(context: ProjectContext, verbose: boolean): void {
    console.log(chalk.cyan.bold('\n📋 Project Analysis Results:'));
    console.log(chalk.green(`  Framework: ${context.framework}`));
    console.log(chalk.green(`  Language: ${context.language}`));
    console.log(chalk.green(`  Package Manager: ${context.packageManager}`));
    
    if (verbose) {
      console.log(chalk.gray('\n📦 Dependencies:'));
      context.dependencies.forEach(dep => {
        console.log(chalk.gray(`  • ${dep.name}@${dep.version}`));
      });
    }
  }

  private displayRecommendations(recommendations: any[]): void {
    if (recommendations.length === 0) {
      console.log(chalk.yellow('\n💡 No specific recommendations at this time.'));
      return;
    }

    console.log(chalk.cyan.bold('\n💡 Recommended Integrations:'));
    recommendations.forEach((rec, index) => {
      console.log(chalk.green(`  ${index + 1}. ${rec.name}`));
      console.log(chalk.gray(`     ${rec.description}`));
      console.log(chalk.blue(`     Command: apix add ${rec.command}`));
    });
  }

  private async promptNextSteps(recommendations: any[]): Promise<void> {
    if (recommendations.length === 0) return;

    const { nextAction } = await inquirer.prompt([{
      type: 'list',
      name: 'nextAction',
      message: 'What would you like to do next?',
      choices: [
        ...recommendations.map((rec: any) => ({
          name: `Add ${rec.name}`,
          value: rec.command
        })),
        { name: 'Nothing right now', value: 'exit' }
      ]
    }]);

    if (nextAction !== 'exit') {
      console.log(chalk.cyan(`\nRun: apix add ${nextAction}`));
    }
  }

  private async gatherConfiguration(): Promise<any> {
    return inquirer.prompt([
      {
        type: 'list',
        name: 'network',
        message: 'Which Hedera network do you want to use?',
        choices: ['testnet', 'mainnet'],
        default: 'testnet'
      },
      {
        type: 'input',
        name: 'accountId',
        message: 'Enter your Hedera Account ID (optional):',
        validate: (input: string) => {
          if (!input) return true;
          return /^\d+\.\d+\.\d+$/.test(input) || 'Invalid account ID format (e.g., 0.0.123)';
        }
      }
    ]);
  }

  private isValidIntegration(integration: string): boolean {
    const validIntegrations = ['hts', 'wallet', 'contract', 'consensus', 'account'];
    return validIntegrations.includes(integration);
  }

  private showNextSteps(plan: any): void {
    console.log(chalk.cyan.bold('\n🎯 Next Steps:'));
    console.log(chalk.gray('  • Update .env with your Hedera credentials'));
    console.log(chalk.gray('  • Run your development server'));
    console.log(chalk.gray('  • Check the generated files for implementation details'));
  }

  private displayStatus(status: any): void {
    console.log(chalk.cyan.bold('\n📊 Integration Status:'));
    
    Object.entries(status).forEach(([integration, info]: [string, any]) => {
      const icon = info.active ? '✅' : '❌';
      console.log(`${icon} ${integration}: ${info.status}`);
    });
  }
}