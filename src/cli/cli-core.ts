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
    try {
      const operations = [
        // Step 1: Scan project files
        async () => {
          return await this.analyzer.analyzeProject(options.directory);
        },
        
        // Step 2: Detect framework
        async () => {
          // This is done in step 1, just return the context
          return null;
        },
        
        // Step 3: Analyze opportunities  
        async () => {
          return null;
        },
        
        // Step 4: Generate recommendations
        async () => {
          const context = await this.analyzer.analyzeProject(options.directory);
          return await this.planner.generateRecommendations(context);
        }
      ];

      const results = await trackSteps(
        INTEGRATION_STEPS.ANALYSIS,
        operations,
        { showTimer: true, showSteps: !options.verbose, compact: false }
      );

      const context = results[0] as ProjectContext;
      const recommendations = results[3] as any[];

      this.displayAnalysisResults(context, options.verbose || false);
      this.displayRecommendations(recommendations);
      await this.promptNextSteps(recommendations);

    } catch (error) {
      logger.error('Analysis failed');
      
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

    try {
      // Shared state for early exit
      let shouldSkipGeneration = false;
      
      const operations = [
        // Step 1: Analyze project
        async () => {
          return await this.analyzer.analyzeProject('.');
        },
        
        // Step 2: Create plan
        async () => {
          const context = await this.analyzer.analyzeProject('.');
          return await this.planner.createIntegrationPlan(integration, options, context);
        },
        
        // Step 3: Validate plan
        async () => {
          const context = await this.analyzer.analyzeProject('.');
          
          // Check for existing integration first
          const existingIntegration = this.analyzer.getIntegrationInfo(context, integration);
          if (existingIntegration && existingIntegration.active && !options.force) {
            console.log(chalk.blue('\n🎯 Integration Detection Result:'));
            console.log(chalk.green(`✅ ${integration.toUpperCase()} integration already installed!`));
            console.log(chalk.gray(`   Version: ${existingIntegration.version || 'unknown'}`));
            console.log(chalk.gray(`   Files: ${existingIntegration.files.length} detected`));
            
            if (existingIntegration.files.length > 0) {
              console.log(chalk.gray('\n📁 Existing integration files:'));
              existingIntegration.files.slice(0, 5).forEach(file => {
                console.log(chalk.gray(`   • ${file}`));
              });
              if (existingIntegration.files.length > 5) {
                console.log(chalk.gray(`   ... and ${existingIntegration.files.length - 5} more files`));
              }
            }
            
            console.log(chalk.cyan('\n💡 Available actions:'));
            console.log(chalk.white(`   • Update integration: ${chalk.cyan(`apix add ${integration} --force`)}`));
            console.log(chalk.white(`   • View status: ${chalk.cyan('apix status')}`));
            console.log(chalk.white(`   • Full analysis: ${chalk.cyan('apix analyze')}`));
            console.log(chalk.gray('\n✨ Your integration is ready to use!'));
            
            // Exit gracefully without throwing an error
            shouldSkipGeneration = true;
            return { context, plan: null, skipGeneration: true };
          }
          
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
          if (shouldSkipGeneration) return true; // Skip if existing integration detected
          // Dependencies are installed during generation, just return success
          return true;
        },
        
        // Step 5: Generate code
        async () => {
          if (shouldSkipGeneration) return true; // Skip if existing integration detected
          
          const context = await this.analyzer.analyzeProject('.');
          const plan = await this.planner.createIntegrationPlan(integration, options, context);
          return await this.generator.generateIntegration(plan, context);
        },
        
        // Step 6: Configure
        async () => {
          if (shouldSkipGeneration) return true; // Skip if existing integration detected
          // Configuration updates are done during generation
          return true;
        },
        
        // Step 7: Final validation
        async () => {
          if (shouldSkipGeneration) return true; // Skip if existing integration detected
          // Could add post-generation validation here
          return true;
        }
      ];

      const results = await trackSteps(steps, operations.slice(0, steps.length), {
        showTimer: true,
        showSteps: true,
        compact: false
      });
      
      // Check if we should skip generation (existing integration detected)
      if (shouldSkipGeneration) {
        // Integration already exists, graceful exit
        return;
      }
      
      const generationResult = results[4]; // Generation result is at index 4
      
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
      logger.error(`Failed to add ${integration} integration`);
      
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
    try {
      const operations = [
        // Step 1: Analyze project
        async () => {
          return await this.analyzer.analyzeProject('.');
        },

        // Step 2: Initialize health checker
        async () => {
          const context = await this.analyzer.analyzeProject('.');
          return new HealthChecker(context);
        },

        // Step 3: Run health checks
        async () => {
          const context = await this.analyzer.analyzeProject('.');
          const healthChecker = new HealthChecker(context);
          return options.quick 
            ? await healthChecker.runQuickHealthCheck() 
            : await healthChecker.runCompleteHealthCheck();
        },

        // Step 4: Display results
        async () => {
          return true; // Just a placeholder for the display step
        }
      ];

      const results = await trackSteps(
        INTEGRATION_STEPS.ANALYSIS,
        operations,
        { showTimer: true, showSteps: true, compact: options.quick }
      );
      
      const report = results[2]; // Health report is at index 2
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
        const context = results[0] as ProjectContext;
        const healthChecker = new HealthChecker(context);
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

    } catch (error) {
      logger.error('Health check failed');
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
      const icon = info.integrated ? '✅' : '❌';
      const name = integration.toUpperCase();
      
      console.log(`${icon} ${name}: ${info.status}`);
      
      if (info.integrated) {
        console.log(chalk.gray(`   Version: ${info.version}`));
        console.log(chalk.gray(`   Files: ${info.fileCount} detected`));
        
        if (info.files.length > 0) {
          const displayFiles = info.files.slice(0, 3);
          console.log(chalk.gray(`   Key files: ${displayFiles.join(', ')}${info.files.length > 3 ? '...' : ''}`));
        }
      }
    });
    
    // Show summary
    const integratedCount = Object.values(status).filter((info: any) => info.integrated).length;
    const totalCount = Object.keys(status).length;
    
    console.log(chalk.gray(`\n📈 Summary: ${integratedCount}/${totalCount} integrations active`));
    
    if (integratedCount > 0) {
      console.log(chalk.cyan('\n💡 Management commands:'));
      console.log(chalk.gray('  • Add integration: apix add <type>'));
      console.log(chalk.gray('  • Update integration: apix add <type> --force'));
      console.log(chalk.gray('  • Health check: apix health'));
    }
  }
}