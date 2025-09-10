#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { APIxCLI } from './cli-core';
import { logger } from '../utils/logger';

const packageJson = require('../../package.json');
const cli = new APIxCLI();

// Initialize CLI asynchronously
let cliInitialized = false;
async function ensureCliInitialized() {
  if (!cliInitialized) {
    await cli.initialize();
    cliInitialized = true;
  }
}

program
  .name('apix')
  .description('AI-powered CLI for Hedera blockchain integrations')
  .version(packageJson.version)
  .hook('preAction', () => {
    console.log(chalk.cyan.bold('🚀 APIx - Hedera Integration AI'));
  });

program
  .command('analyze')
  .description('Analyze your project and suggest Hedera integrations')
  .option('-d, --directory <path>', 'Project directory to analyze', '.')
  .option('-v, --verbose', 'Show detailed analysis')
  .action(async (options) => {
    try {
      await ensureCliInitialized();
      await cli.analyze(options);
    } catch (error) {
      logger.error('Analysis failed:', error);
      process.exit(1);
    }
  });

program
  .command('add <integration>')
  .description('Add Hedera integration to your project')
  .option('-n, --name <n>', 'Integration name')
  .option('-s, --symbol <symbol>', 'Token symbol (for HTS)')
  .option('-p, --provider <provider>', 'Wallet provider')
  .option('-t, --type <type>', 'Contract type')
  .option('-f, --force', 'Force overwrite existing files')
  .action(async (integration, options) => {
    try {
      await ensureCliInitialized();
      await cli.addIntegration(integration, options);
    } catch (error) {
      logger.error('Integration failed:', error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize APIx configuration in your project')
  .option('-f, --force', 'Force reinitialize')
  .action(async (options) => {
    try {
      await cli.init(options);
    } catch (error) {
      logger.error('Initialization failed:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check status of Hedera integrations')
  .action(async () => {
    try {
      await cli.status();
    } catch (error) {
      logger.error('Status check failed:', error);
      process.exit(1);
    }
  });

program
  .command('health')
  .description('Run health checks on your project and integrations')
  .option('-q, --quick', 'Run quick health check')
  .option('--fix', 'Show auto-fix suggestions')
  .action(async (options) => {
    try {
      await cli.health(options);
    } catch (error) {
      logger.error('Health check failed:', error);
      process.exit(1);
    }
  });

program.showHelpAfterError();

try {
  program.parse(process.argv);
  
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
} catch (error: any) {
  // Commander throws an error when showing help, this is normal
  if (error.code !== 'commander.helpDisplayed') {
    logger.error('Command failed:', error);
    process.exit(1);
  }
}

export { program };