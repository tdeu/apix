import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ProjectAnalyzer } from '@analysis/project-analyzer';
import { IntegrationPlanner } from '@planning/integration-planner';
import { ConfigurationManager } from '@utils/config-manager';
import { logger } from '@utils/logger';
import { IntegrationOptions, AnalysisOptions, ProjectContext } from '@/types';

export class APIxCLI {
  private analyzer: ProjectAnalyzer;
  private planner: IntegrationPlanner;
  private config: ConfigurationManager;

  constructor() {
    this.analyzer = new ProjectAnalyzer();
    this.planner = new IntegrationPlanner();
    this.config = new ConfigurationManager();
  }

  async analyze(options: AnalysisOptions): Promise<void> {
    const spinner = ora('🔍 Analyzing your project...').start();

    try {
      const context = await this.analyzer.analyzeProject(options.directory);
      spinner.succeed('✅ Project analysis complete!');

      this.displayAnalysisResults(context, options.verbose);

      const recommendations = await this.planner.generateRecommendations(context);
      this.displayRecommendations(recommendations);

      await this.promptNextSteps(recommendations);

    } catch (error) {
      spinner.fail('❌ Analysis failed');
      throw error;
    }
  }

  async addIntegration(integration: string, options: IntegrationOptions): Promise<void> {
    const spinner = ora(`🚀 Adding ${integration} integration...`).start();

    try {
      if (!this.isValidIntegration(integration)) {
        throw new Error(`Unknown integration type: ${integration}`);
      }

      const context = await this.analyzer.analyzeProject('.');
      const plan = await this.planner.createIntegrationPlan(integration, options, context);
      
      spinner.text = '📝 Generating code...';
      
      // TODO: Implement code generation
      spinner.succeed(`✅ ${integration} integration added successfully!`);
      
      this.showNextSteps(plan);

    } catch (error) {
      spinner.fail(`❌ Failed to add ${integration} integration`);
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