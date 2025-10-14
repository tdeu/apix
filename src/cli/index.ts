#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

import { program } from 'commander';
import chalk from 'chalk';
import { APIxCLI } from './cli-core';
import { logger, LogLevel } from '../utils/logger';
import { debugLogger, LogLevel as DebugLogLevel } from '../utils/debug-logger';
import { formatter, createFormatter } from '../utils/output-formatter';

const packageJson = require('../../package.json');
let cli: APIxCLI;

// Initialize CLI asynchronously
let cliInitialized = false;
async function ensureCliInitialized(options: any = {}) {
  if (!cliInitialized) {
    // Set logging level before initialization to suppress startup logs
    setupLogging(options);
    
    // Temporarily suppress console output during initialization unless in debug mode
    const originalConsoleLog = console.log;
    const originalConsoleInfo = console.info;
    const originalConsoleWarn = console.warn;
    
    if (!options.debug && !options.verbose) {
      console.log = () => {};
      console.info = () => {};
      console.warn = () => {};
    }
    
    try {
      // Import and create CLI instance with suppressed output
      const { APIxCLI } = await import('./cli-core');
      cli = new APIxCLI();
      await cli.initialize();
    } finally {
      // Restore console output
      console.log = originalConsoleLog;
      console.info = originalConsoleInfo; 
      console.warn = originalConsoleWarn;
    }
    
    cliInitialized = true;
  }
}

// Setup logging and formatting based on CLI options
function setupLogging(options: any) {
  // Configure main logger based on flags
  if (options.quiet) {
    logger.setLevel(LogLevel.ERROR); // Only show errors
    logger.setInternalLevel(LogLevel.SILENT); // Suppress internal logs
  } else if (options.debug) {
    logger.setLevel(LogLevel.DEBUG);
    logger.setInternalLevel(LogLevel.DEBUG);
  } else if (options.verbose) {
    logger.setLevel(LogLevel.VERBOSE);
    logger.setInternalLevel(LogLevel.INFO);
  } else {
    logger.setLevel(LogLevel.INFO); // Default level
    logger.setInternalLevel(LogLevel.WARN);
  }

  // Configure output formatter
  formatter.configure({
    quiet: options.quiet,
    jsonMode: options.json,
    maxWidth: process.stdout.columns || 80
  });

  // Setup debug logging for development
  if (options.trace) {
    debugLogger.setLevel(DebugLogLevel.TRACE);
    debugLogger.setTrace(true);
  } else if (options.debug) {
    debugLogger.setLevel(DebugLogLevel.DEBUG);
  } else if (options.verbose) {
    debugLogger.setLevel(DebugLogLevel.INFO);
  }

  // Handle file logging options
  if (options.noFileLogging) {
    debugLogger.setFileLogging(false);
  }

  // Handle custom log file path
  if (options.logFile) {
    debugLogger.info('Custom log file path specified', { path: options.logFile });
  }

  // Internal debug logging only in debug mode
  if (options.debug) {
    debugLogger.debug('Logging configured', {
      level: options.quiet ? 'QUIET' : options.debug ? 'DEBUG' : options.verbose ? 'VERBOSE' : 'INFO',
      jsonMode: options.json,
      fileLogging: !options.noFileLogging,
      customLogFile: options.logFile || null
    });
  }
}

program
  .name('apix')
  .description('Enterprise AI-powered Hedera development assistant')
  .version(packageJson.version)
  .option('-q, --quiet', 'Minimal output (errors only)')
  .option('-v, --verbose', 'Detailed output')
  .option('--debug', 'Debug output with internal details')
  .option('--json', 'JSON output format')
  .option('--trace', 'Trace logging with stack traces')
  .option('--log-file <path>', 'Custom log file path')
  .option('--no-file-logging', 'Disable file logging')
  .hook('preAction', (thisCommand, actionCommand) => {
    // Setup logging and formatting based on global options
    const options = program.opts();
    setupLogging(options);

    // Show minimal header unless in quiet mode
    if (!options.quiet && !options.json) {
      console.log(chalk.bold('APIX AI'), chalk.gray(`v${packageJson.version}`));
      if (options.verbose) {
        console.log(chalk.gray('Enterprise Hedera Development Assistant\n'));
      }
    }
  });

program
  .command('analyze')
  .description('Analyze your project and suggest Hedera integrations')
  .option('-d, --directory <path>', 'Project directory to analyze', '.')
  .option('-v, --verbose', 'Show detailed analysis')
  .action(async (options) => {
    const globalOptions = program.opts();
    const allOptions = { ...options, ...globalOptions };

    debugLogger.startCommand('analyze', [options.directory || '.']);
    debugLogger.debug('Starting project analysis', { options: allOptions });

    try {
      await ensureCliInitialized(allOptions);
      const result = await cli.analyze(allOptions);
      debugLogger.endCommand(true, result);
      debugLogger.success('Project analysis completed successfully');
    } catch (error: any) {
      debugLogger.endCommand(false);
      debugLogger.error('Analysis failed', error, {
        command: 'analyze',
        options: allOptions,
        stack: error?.stack
      });
      formatter.error('Analysis failed. Use --debug for detailed error information.');
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
    const globalOptions = program.opts();
    const allOptions = { ...options, ...globalOptions };

    debugLogger.startCommand('add', [integration, JSON.stringify(options)]);
    debugLogger.debug('Starting integration addition', {
      integration,
      options: allOptions
    });

    try {
      await ensureCliInitialized();
      const result = await cli.addIntegration(integration, options);
      debugLogger.endCommand(true, result);
      debugLogger.success(`Integration '${integration}' added successfully`);
    } catch (error: any) {
      debugLogger.endCommand(false);
      debugLogger.error('Integration failed', error, {
        command: 'add',
        integration,
        options: allOptions,
        stack: error?.stack
      });
      console.error(chalk.red(`❌ Integration '${integration}' failed. Use --debug for detailed error information.`));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize APIx configuration in your project')
  .option('-f, --force', 'Force reinitialize')
  .action(async (options) => {
    const globalOptions = program.opts();
    const allOptions = { ...options, ...globalOptions };

    try {
      await ensureCliInitialized(allOptions);
      await cli.init(options);
    } catch (error) {
      logger.error('Initialization failed:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check status of Hedera integrations')
  .action(async (options) => {
    const globalOptions = program.opts();
    const allOptions = { ...options, ...globalOptions };

    try {
      await ensureCliInitialized(allOptions);
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
    const globalOptions = program.opts();
    const allOptions = { ...options, ...globalOptions };

    debugLogger.startCommand('health', [options.quick ? '--quick' : '']);
    debugLogger.debug('Starting health check', { options: allOptions });

    try {
      await ensureCliInitialized(allOptions);
      const result = await cli.health(options);
      debugLogger.endCommand(true, result);
      debugLogger.success('Health check completed successfully');
    } catch (error: any) {
      debugLogger.endCommand(false);
      debugLogger.error('Health check failed', error, {
        command: 'health',
        options: allOptions,
        stack: error?.stack
      });
      console.error(chalk.red('❌ Health check failed. Use --debug for detailed error information.'));
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
    const globalOptions = program.opts();
    const allOptions = { ...options, ...globalOptions };

    debugLogger.startCommand('generate', [integration, JSON.stringify(options)]);
    debugLogger.debug('Starting enterprise generation', {
      integration,
      options: allOptions
    });

    try {
      await ensureCliInitialized();
      const result = await cli.generateEnterpriseIntegration(integration, options);
      debugLogger.endCommand(true, result);
      debugLogger.success(`Enterprise integration '${integration}' generated successfully`);
    } catch (error: any) {
      debugLogger.endCommand(false);
      debugLogger.error('Enterprise generation failed', error, {
        command: 'generate',
        integration,
        options: allOptions,
        stack: error?.stack
      });
      console.error(chalk.red(`❌ Enterprise generation '${integration}' failed. Use --debug for detailed error information.`));
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
  .option('--clean', 'Start in clean mode without enhanced UI features')
  .action(async (options) => {
    const globalOptions = program.opts();
    const allOptions = { ...options, ...globalOptions };

    try {
      await ensureCliInitialized(allOptions);
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
    const globalOptions = program.opts();
    const allOptions = { ...options, ...globalOptions };

    try {
      await ensureCliInitialized(allOptions);
      await cli.generateRecommendations(allOptions);
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
    const globalOptions = program.opts();
    const allOptions = { ...options, ...globalOptions };

    debugLogger.startCommand('create-token', [options.name, options.symbol]);
    debugLogger.debug('Starting token creation', { options: allOptions });

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

      const result = await cli.createTokenOnBlockchain(tokenOptions);
      debugLogger.endCommand(true, result);
      debugLogger.success(`Token '${options.name}' created successfully`);
    } catch (error: any) {
      debugLogger.endCommand(false);
      debugLogger.error('Token creation failed', error, {
        command: 'create-token',
        options: allOptions,
        stack: error?.stack
      });
      console.error(chalk.red('❌ Token creation failed. Use --debug for detailed error information.'));
      process.exit(1);
    }
  });

// =============================================================================
// DEBUG DASHBOARD COMMANDS
// =============================================================================

program
  .command('logs')
  .description('View recent APIX command logs')
  .option('-n, --count <count>', 'Number of log entries to show', '50')
  .option('-l, --level <level>', 'Filter by log level (error, warn, info, debug, trace)')
  .option('-c, --command <command>', 'Filter by command name')
  .action(async (options) => {
    try {
      const count = parseInt(options.count);
      const logs = await debugLogger.getRecentLogs(count);

      const filteredLogs = logs.filter(log => {
        if (options.level && log.level !== DebugLogLevel[options.level.toUpperCase() as keyof typeof DebugLogLevel]) {
          return false;
        }
        if (options.command && log.command !== options.command) {
          return false;
        }
        return true;
      });

      console.log(chalk.cyan.bold(`📊 Recent APIX Logs (${filteredLogs.length} entries)`));
      console.log(chalk.gray(`Log directory: ${debugLogger.getLogDirectory()}\n`));

      if (filteredLogs.length === 0) {
        console.log(chalk.yellow('No logs found matching the criteria.'));
        return;
      }

      for (const log of filteredLogs) {
        const timestamp = new Date(log.timestamp).toLocaleString();
        const levelColors: Record<number, any> = {
          [DebugLogLevel.ERROR]: chalk.red,
          [DebugLogLevel.WARN]: chalk.yellow,
          [DebugLogLevel.INFO]: chalk.blue,
          [DebugLogLevel.DEBUG]: chalk.gray,
          [DebugLogLevel.TRACE]: chalk.magenta
        };

        const levelColor = levelColors[log.level] || chalk.white;
        const levelName = DebugLogLevel[log.level];

        console.log(`${chalk.dim(timestamp)} ${levelColor(levelName.padEnd(5))} ${log.message}`);

        if (log.command) {
          console.log(`  ${chalk.cyan('Command:')} ${log.command}`);
        }

        if (log.context) {
          console.log(`  ${chalk.gray(JSON.stringify(log.context, null, 2))}`);
        }

        if (log.error) {
          console.log(`  ${chalk.red('Error:')} ${log.error.message}`);
          if (log.error.stack && options.trace) {
            console.log(`  ${chalk.red('Stack:')} ${log.error.stack}`);
          }
        }

        console.log('');
      }
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to retrieve logs:'), error.message);
      process.exit(1);
    }
  });

program
  .command('last-error')
  .description('Show details of the last error that occurred')
  .action(async () => {
    try {
      const lastError = await debugLogger.getLastError();

      if (!lastError) {
        console.log(chalk.green('✅ No recent errors found!'));
        return;
      }

      console.log(chalk.red.bold('❌ Last Error Details'));
      console.log(chalk.gray(`Occurred: ${new Date(lastError.timestamp).toLocaleString()}\n`));

      console.log(chalk.cyan('Message:'), lastError.message);

      if (lastError.command) {
        console.log(chalk.cyan('Command:'), lastError.command);
      }

      if (lastError.context) {
        console.log(chalk.cyan('Context:'));
        console.log(JSON.stringify(lastError.context, null, 2));
      }

      if (lastError.error) {
        console.log(chalk.cyan('Error Details:'));
        console.log(`  Message: ${lastError.error.message}`);
        if (lastError.error.code) {
          console.log(`  Code: ${lastError.error.code}`);
        }
        if (lastError.error.stack) {
          console.log(`  Stack: ${lastError.error.stack}`);
        }
      }

      console.log(chalk.yellow('\n💡 Tip: Use --debug flag with commands for detailed logging.'));
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to retrieve last error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('debug-info')
  .description('Show debug configuration and log file information')
  .action(async () => {
    try {
      console.log(chalk.cyan.bold('🔍 APIX Debug Configuration'));
      console.log('');

      console.log(chalk.cyan('Log Directory:'), debugLogger.getLogDirectory());
      console.log(chalk.cyan('Current Log File:'), debugLogger.getCurrentLogFile() || 'None');

      // Check log directory size
      const fs = require('fs-extra');
      const path = require('path');
      const logDir = debugLogger.getLogDirectory();

      if (await fs.pathExists(logDir)) {
        const files = await fs.readdir(logDir);
        const logFiles = files.filter((f: string) => f.endsWith('.log'));
        console.log(chalk.cyan('Total Log Files:'), logFiles.length);

        if (logFiles.length > 0) {
          let totalSize = 0;
          for (const file of logFiles) {
            const stats = await fs.stat(path.join(logDir, file));
            totalSize += stats.size;
          }
          console.log(chalk.cyan('Total Log Size:'), `${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        }
      } else {
        console.log(chalk.yellow('Log directory does not exist yet.'));
      }

      console.log('');
      console.log(chalk.cyan.bold('Available Debug Commands:'));
      console.log('  apix logs                 - View recent logs');
      console.log('  apix last-error          - Show last error details');
      console.log('  apix debug-info          - Show this information');
      console.log('');
      console.log(chalk.cyan.bold('Debug Flags:'));
      console.log('  --debug                  - Enable debug logging');
      console.log('  --verbose               - Enable verbose output');
      console.log('  --trace                 - Enable trace logging with stack traces');
      console.log('  --log-file <path>       - Custom log file path');
      console.log('  --no-file-logging       - Disable file logging');
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to retrieve debug information:'), error.message);
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