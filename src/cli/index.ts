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
  .description('Enterprise AI-powered Hedera development assistant with code composition and live blockchain validation')
  .version(packageJson.version)
  .hook('preAction', () => {
    console.log(chalk.cyan.bold('🚀 APIX AI - Enterprise Hedera Development Assistant'));
    console.log(chalk.gray(`Version ${packageJson.version} - AI Code Composition & Live Blockchain Validation\n`));
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

// =============================================================================
// ENTERPRISE AI COMMANDS
// =============================================================================

program
  .command('generate <integration>')
  .description('Generate enterprise Hedera integration with AI-powered code composition')
  .option('--industry <industry>', 'Target industry (pharmaceutical, financial-services, insurance, etc.)')
  .option('--regulation <regulations...>', 'Applicable regulations (FDA-21CFR11, SOX, GDPR, etc.)')
  .option('--business-context <context>', 'Business context description')
  .option('--business-goals <goals...>', 'Business goals (compliance, automation, cost-reduction, etc.)')
  .option('--integration-type <type>', 'Integration complexity (simple, moderate, complex, novel)')
  .option('--framework <framework>', 'Target framework override')
  .option('--custom-logic', 'Enable AI custom logic generation')
  .option('--validate-live', 'Perform live Hedera blockchain validation')
  .option('-f, --force', 'Force overwrite existing files')
  .action(async (integration, options) => {
    try {
      await ensureCliInitialized();
      await cli.generateEnterpriseIntegration(integration, options);
    } catch (error) {
      logger.error('Enterprise generation failed:', error);
      process.exit(1);
    }
  });

program
  .command('compose')
  .description('AI-powered custom code composition for novel requirements')
  .option('--requirements <requirements>', 'Natural language requirement description')
  .option('--industry <industry>', 'Target industry context')
  .option('--constraints <constraints...>', 'Technical or business constraints')
  .option('--templates <templates...>', 'Base templates to combine')
  .option('--novel-pattern', 'Create entirely new implementation pattern')
  .option('--validate-live', 'Perform live Hedera validation')
  .action(async (options) => {
    try {
      await ensureCliInitialized();
      await cli.composeCustomCode(options);
    } catch (error) {
      logger.error('AI composition failed:', error);
      process.exit(1);
    }
  });

program
  .command('chat')
  .description('Interactive conversational interface for enterprise Hedera development')
  .option('--context <context>', 'Initial business context')
  .option('--industry <industry>', 'Industry context')
  .option('--session-file <file>', 'Load previous conversation session')
  .action(async (options) => {
    try {
      await ensureCliInitialized();
      await cli.startConversationalInterface(options);
    } catch (error) {
      logger.error('Conversational interface failed:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Comprehensive validation with live Hedera blockchain testing')
  .option('--testnet', 'Use Hedera testnet for validation')
  .option('--mainnet', 'Use Hedera mainnet for validation (production)')
  .option('--enterprise', 'Run enterprise-grade compliance validation')
  .option('--compliance <frameworks...>', 'Test specific compliance frameworks')
  .option('--performance', 'Include performance testing')
  .option('--security', 'Include security vulnerability scanning')
  .option('--files <files...>', 'Validate specific files')
  .action(async (options) => {
    try {
      await ensureCliInitialized();
      await cli.comprehensiveValidation(options);
    } catch (error) {
      logger.error('Comprehensive validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('recommend')
  .description('AI-powered enterprise Hedera service recommendations')
  .option('--business-goals <goals...>', 'Business objectives')
  .option('--industry <industry>', 'Industry context')
  .option('--current-systems <systems...>', 'Existing systems to integrate')
  .option('--regulations <regulations...>', 'Regulatory requirements')
  .option('--budget <budget>', 'Budget constraints')
  .option('--timeline <timeline>', 'Implementation timeline')
  .option('--interactive', 'Interactive recommendation wizard')
  .action(async (options) => {
    try {
      await ensureCliInitialized();
      await cli.generateRecommendations(options);
    } catch (error) {
      logger.error('Recommendation generation failed:', error);
      process.exit(1);
    }
  });

program
  .command('explain')
  .description('AI-powered explanations of Hedera concepts and enterprise patterns')
  .argument('<concept>', 'Concept to explain (e.g., "HTS vs smart contracts for loyalty points")')
  .option('--industry <industry>', 'Industry-specific explanation')
  .option('--detailed', 'Provide detailed technical explanation')
  .option('--examples', 'Include practical examples')
  .option('--regulations', 'Include regulatory considerations')
  .action(async (concept, options) => {
    try {
      await ensureCliInitialized();
      await cli.explainConcept(concept, options);
    } catch (error) {
      logger.error('Concept explanation failed:', error);
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('AI-powered comparison of Hedera approaches for enterprise use cases')
  .argument('<approaches>', 'Approaches to compare (e.g., "HCS vs smart contracts for audit trails")')
  .option('--use-case <usecase>', 'Specific use case context')
  .option('--industry <industry>', 'Industry context')
  .option('--criteria <criteria...>', 'Comparison criteria (cost, performance, compliance, etc.)')
  .action(async (approaches, options) => {
    try {
      await ensureCliInitialized();
      await cli.compareApproaches(approaches, options);
    } catch (error) {
      logger.error('Approach comparison failed:', error);
      process.exit(1);
    }
  });

program
  .command('confidence')
  .description('Assess AI confidence levels for specific requirements')
  .argument('<requirement>', 'Requirement to assess')
  .option('--industry <industry>', 'Industry context')
  .option('--complexity <complexity>', 'Requirement complexity level')
  .option('--detailed', 'Show detailed confidence breakdown')
  .action(async (requirement, options) => {
    try {
      await ensureCliInitialized();
      await cli.assessConfidence(requirement, options);
    } catch (error) {
      logger.error('Confidence assessment failed:', error);
      process.exit(1);
    }
  });

program
  .command('debug')
  .description('AI-powered debugging assistance for Hedera integration issues')
  .argument('<issue>', 'Issue description or error message')
  .option('--context <context>', 'Additional context about the issue')
  .option('--files <files...>', 'Related files to analyze')
  .option('--logs <logfile>', 'Log file to analyze')
  .option('--suggest-fixes', 'Provide fix suggestions')
  .action(async (issue, options) => {
    try {
      await ensureCliInitialized();
      await cli.debugIssue(issue, options);
    } catch (error) {
      logger.error('Debug assistance failed:', error);
      process.exit(1);
    }
  });

program
  .command('deploy')
  .description('Enterprise deployment with compliance checking and audit trails')
  .option('--environment <env>', 'Target environment (development, staging, production)')
  .option('--compliance-check', 'Run compliance validation before deployment')
  .option('--audit-trail', 'Enable deployment audit trail')
  .option('--rollback-plan', 'Generate rollback procedures')
  .option('--monitoring', 'Set up monitoring and alerts')
  .option('--dry-run', 'Simulate deployment without executing')
  .action(async (options) => {
    try {
      await ensureCliInitialized();
      await cli.enterpriseDeployment(options);
    } catch (error) {
      logger.error('Enterprise deployment failed:', error);
      process.exit(1);
    }
  });

program
  .command('create-token')
  .description('Create a token directly on Hedera blockchain (live blockchain operation)')
  .option('-n, --name <name>', 'Token name', 'Test Token')
  .option('-s, --symbol <symbol>', 'Token symbol', 'TEST')
  .option('-d, --decimals <decimals>', 'Token decimals', '8')
  .option('--supply <supply>', 'Initial supply', '1000000')
  .option('--admin-key', 'Enable admin key', false)
  .option('--supply-key', 'Enable supply key', false)
  .option('--freeze-key', 'Enable freeze key', false)
  .option('--wipe-key', 'Enable wipe key', false)
  .option('--testnet', 'Use testnet (default)')
  .option('--mainnet', 'Use mainnet (production)')
  .action(async (options) => {
    try {
      await ensureCliInitialized();

      // Convert string options to numbers where needed
      const tokenOptions = {
        name: options.name,
        symbol: options.symbol,
        decimals: parseInt(options.decimals),
        initialSupply: parseInt(options.supply),
        adminKey: options.adminKey,
        supplyKey: options.supplyKey,
        freezeKey: options.freezeKey,
        wipeKey: options.wipeKey
      };

      await cli.createTokenOnBlockchain(tokenOptions);
    } catch (error) {
      logger.error('Token creation failed:', error);
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