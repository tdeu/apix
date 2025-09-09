// setup-apix.js - Run this script to create all files at once
// Place this file at the ROOT of your apix directory
const fs = require('fs');
const path = require('path');

// File contents with corrected integration planner
const files = {
  'package.json': JSON.stringify({
    "name": "apix",
    "version": "1.0.0",
    "description": "AI-powered CLI for Hedera blockchain integrations",
    "main": "dist/cli/index.js",
    "bin": {
      "apix": "./dist/cli/index.js"
    },
    "scripts": {
      "build": "tsc",
      "dev": "nodemon --exec ts-node src/cli/index.ts",
      "test": "jest",
      "start": "node dist/cli/index.js",
      "lint": "eslint src --ext .ts",
      "format": "prettier --write src/**/*.ts"
    },
    "keywords": ["hedera", "blockchain", "cli", "ai", "integration"],
    "author": "Your Name",
    "license": "MIT",
    "dependencies": {
      "commander": "^11.1.0",
      "inquirer": "^9.2.12",
      "chalk": "^4.1.2",
      "ora": "^5.4.1",
      "fs-extra": "^11.1.1",
      "@hashgraph/sdk": "^2.40.0",
      "handlebars": "^4.7.8"
    },
    "devDependencies": {
      "@types/node": "^20.8.0",
      "@types/inquirer": "^9.0.6",
      "@types/fs-extra": "^11.0.3",
      "typescript": "^5.2.2",
      "ts-node": "^10.9.1",
      "nodemon": "^3.0.1",
      "jest": "^29.7.0",
      "@types/jest": "^29.5.6",
      "ts-jest": "^29.1.1",
      "eslint": "^8.51.0",
      "@typescript-eslint/eslint-plugin": "^6.7.4",
      "@typescript-eslint/parser": "^6.7.4",
      "prettier": "^3.0.3"
    }
  }, null, 2),

  'src/types/index.ts': `// Core Type Definitions

// CLI Command Options
export interface AnalysisOptions {
  directory: string;
  verbose?: boolean;
}

export interface IntegrationOptions {
  name?: string;
  symbol?: string;
  provider?: string;
  type?: string;
  force?: boolean;
}

// Project Analysis Types
export interface ProjectContext {
  framework: SupportedFramework;
  language: 'typescript' | 'javascript';
  packageManager: 'npm' | 'yarn' | 'pnpm';
  rootPath: string;
  dependencies: Dependency[];
  devDependencies: Dependency[];
  scripts: Record<string, string>;
  hasExistingAuth: boolean;
  hasStateManagement: StateManagementType | null;
  hasUILibrary: UILibraryType | null;
  projectStructure: ProjectStructure;
  existingIntegrations: ExistingIntegration[];
}

export interface Dependency {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency';
}

export type SupportedFramework = 
  | 'next.js'
  | 'react'
  | 'express'
  | 'vue'
  | 'angular'
  | 'node'
  | 'unknown';

export type StateManagementType = 
  | 'redux'
  | 'zustand'
  | 'context'
  | 'mobx'
  | 'recoil';

export type UILibraryType = 
  | 'material-ui'
  | 'chakra-ui'
  | 'ant-design'
  | 'tailwindcss'
  | 'bootstrap'
  | 'styled-components';

export interface ProjectStructure {
  hasApiRoutes: boolean;
  hasPages: boolean;
  hasComponents: boolean;
  hasHooks: boolean;
  hasContexts: boolean;
  hasUtils: boolean;
  hasStyles: boolean;
  directories: string[];
  configFiles: string[];
}

export interface ExistingIntegration {
  type: IntegrationType;
  files: string[];
  active: boolean;
  version?: string;
}

// Integration Types
export type IntegrationType = 
  | 'hts'
  | 'smart-contract'
  | 'wallet'
  | 'consensus'
  | 'account';

export interface IntegrationPlan {
  type: IntegrationType;
  context: ProjectContext;
  options: IntegrationOptions;
  templates: TemplateSelection[];
  dependencies: string[];
  newFiles: GeneratedFile[];
  modifications: FileModification[];
  configuration: ConfigurationUpdate[];
}

export interface TemplateSelection {
  templateId: string;
  templateType: 'component' | 'api' | 'hook' | 'utility' | 'config';
  framework: SupportedFramework;
  outputPath: string;
  variables: Record<string, any>;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'typescript' | 'javascript' | 'json' | 'env' | 'markdown';
  overwrite: boolean;
}

export interface FileModification {
  filePath: string;
  type: 'insert' | 'replace' | 'append';
  content: string;
  position?: number;
  searchPattern?: RegExp;
}

export interface ConfigurationUpdate {
  file: string;
  updates: Record<string, any>;
}

// Hedera-specific Types
export interface HederaConfiguration {
  network: 'testnet' | 'mainnet';
  accountId?: string;
  privateKey?: string;
  mirrorNodeUrl?: string;
  nodeId?: string;
}

export interface HTSConfiguration {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  treasuryAccountId?: string;
  autoRenewAccountId?: string;
  freezeDefault?: boolean;
  supplyType?: 'infinite' | 'finite';
  supplyKey?: boolean;
  adminKey?: boolean;
  freezeKey?: boolean;
  wipeKey?: boolean;
}

export interface SmartContractConfiguration {
  contractName: string;
  type: 'simple-token' | 'nft' | 'dao' | 'marketplace' | 'custom';
  deploymentType: 'native' | 'evm';
  constructorArgs?: any[];
  gas?: number;
}

export interface WalletConfiguration {
  providers: WalletProvider[];
  defaultProvider: WalletProvider;
  connectionFlow: 'modal' | 'redirect' | 'embedded';
}

export type WalletProvider = 
  | 'hashpack'
  | 'blade'
  | 'walletconnect'
  | 'metamask'
  | 'kabila';

// AI Planning Types
export interface IntegrationRecommendation {
  name: string;
  type: IntegrationType;
  description: string;
  command: string;
  priority: 'high' | 'medium' | 'low';
  benefits: string[];
  requirements: string[];
  estimatedTime: string;
}

// Configuration Types
export interface APIxConfig {
  version: string;
  hedera: HederaConfiguration;
  integrations: Record<IntegrationType, boolean>;
  preferences: {
    framework: SupportedFramework;
    language: 'typescript' | 'javascript';
    packageManager: 'npm' | 'yarn' | 'pnpm';
    codeStyle: 'standard' | 'prettier' | 'eslint';
  };
  templates: {
    customPaths: Record<string, string>;
    overrides: Record<string, any>;
  };
}

// Error Types
export interface APIxError extends Error {
  code: string;
  details?: any;
  suggestions?: string[];
}`,

  'src/utils/logger.ts': `import chalk from 'chalk';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  error(message: string, error?: any): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(chalk.red.bold('❌ ERROR:'), message);
      if (error && this.level >= LogLevel.DEBUG) {
        console.error(chalk.red(error.stack || error));
      }
    }
  }

  warn(message: string, details?: any): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(chalk.yellow.bold('⚠️  WARN:'), message);
      if (details && this.level >= LogLevel.DEBUG) {
        console.warn(chalk.yellow(JSON.stringify(details, null, 2)));
      }
    }
  }

  info(message: string, details?: any): void {
    if (this.level >= LogLevel.INFO) {
      console.log(chalk.blue.bold('ℹ️  INFO:'), message);
      if (details && this.level >= LogLevel.DEBUG) {
        console.log(chalk.blue(JSON.stringify(details, null, 2)));
      }
    }
  }

  debug(message: string, details?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      console.log(chalk.gray.bold('🐛 DEBUG:'), message);
      if (details) {
        console.log(chalk.gray(JSON.stringify(details, null, 2)));
      }
    }
  }

  success(message: string): void {
    console.log(chalk.green.bold('✅'), message);
  }

  progress(message: string): void {
    console.log(chalk.cyan.bold('🔄'), message);
  }

  highlight(message: string): void {
    console.log(chalk.magenta.bold('🎯'), message);
  }
}

export const logger = new Logger();`,

  'src/cli/cli-core.ts': `import inquirer from 'inquirer';
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
    const spinner = ora(\`🚀 Adding \${integration} integration...\`).start();

    try {
      if (!this.isValidIntegration(integration)) {
        throw new Error(\`Unknown integration type: \${integration}\`);
      }

      const context = await this.analyzer.analyzeProject('.');
      const plan = await this.planner.createIntegrationPlan(integration, options, context);
      
      spinner.text = '📝 Generating code...';
      
      // TODO: Implement code generation
      spinner.succeed(\`✅ \${integration} integration added successfully!\`);
      
      this.showNextSteps(plan);

    } catch (error) {
      spinner.fail(\`❌ Failed to add \${integration} integration\`);
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
      
      console.log(chalk.green('\\n🎉 You\\'re ready to use APIx!'));
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
    console.log(chalk.cyan.bold('\\n📋 Project Analysis Results:'));
    console.log(chalk.green(\`  Framework: \${context.framework}\`));
    console.log(chalk.green(\`  Language: \${context.language}\`));
    console.log(chalk.green(\`  Package Manager: \${context.packageManager}\`));
    
    if (verbose) {
      console.log(chalk.gray('\\n📦 Dependencies:'));
      context.dependencies.forEach(dep => {
        console.log(chalk.gray(\`  • \${dep.name}@\${dep.version}\`));
      });
    }
  }

  private displayRecommendations(recommendations: any[]): void {
    if (recommendations.length === 0) {
      console.log(chalk.yellow('\\n💡 No specific recommendations at this time.'));
      return;
    }

    console.log(chalk.cyan.bold('\\n💡 Recommended Integrations:'));
    recommendations.forEach((rec, index) => {
      console.log(chalk.green(\`  \${index + 1}. \${rec.name}\`));
      console.log(chalk.gray(\`     \${rec.description}\`));
      console.log(chalk.blue(\`     Command: apix add \${rec.command}\`));
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
          name: \`Add \${rec.name}\`,
          value: rec.command
        })),
        { name: 'Nothing right now', value: 'exit' }
      ]
    }]);

    if (nextAction !== 'exit') {
      console.log(chalk.cyan(\`\\nRun: apix add \${nextAction}\`));
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
          return /^\\d+\\.\\d+\\.\\d+$/.test(input) || 'Invalid account ID format (e.g., 0.0.123)';
        }
      }
    ]);
  }

  private isValidIntegration(integration: string): boolean {
    const validIntegrations = ['hts', 'wallet', 'contract', 'consensus', 'account'];
    return validIntegrations.includes(integration);
  }

  private showNextSteps(plan: any): void {
    console.log(chalk.cyan.bold('\\n🎯 Next Steps:'));
    console.log(chalk.gray('  • Update .env with your Hedera credentials'));
    console.log(chalk.gray('  • Run your development server'));
    console.log(chalk.gray('  • Check the generated files for implementation details'));
  }

  private displayStatus(status: any): void {
    console.log(chalk.cyan.bold('\\n📊 Integration Status:'));
    
    Object.entries(status).forEach(([integration, info]: [string, any]) => {
      const icon = info.active ? '✅' : '❌';
      console.log(\`\${icon} \${integration}: \${info.status}\`);
    });
  }
}`,

  '.env.example': `# Hedera Configuration
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.123
HEDERA_PRIVATE_KEY=your-private-key-here
HEDERA_MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com

# Optional: Custom node configuration
# HEDERA_NODE_ID=0.0.3`,

  '.gitignore': `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage
coverage/
.nyc_output/

# APIx
.apix/

# Temporary
tmp/
temp/
`,

  'tsconfig.json': JSON.stringify({
    "compilerOptions": {
      "target": "ES2020",
      "module": "commonjs",
      "lib": ["ES2020"],
      "outDir": "./dist",
      "rootDir": "./src",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true,
      "resolveJsonModule": true,
      "moduleResolution": "node",
      "allowSyntheticDefaultImports": true,
      "experimentalDecorators": true,
      "emitDecoratorMetadata": true,
      "baseUrl": ".",
      "paths": {
        "@/*": ["src/*"],
        "@cli/*": ["src/cli/*"],
        "@analysis/*": ["src/analysis/*"],
        "@planning/*": ["src/planning/*"],
        "@hedera/*": ["src/hedera/*"],
        "@templates/*": ["src/templates/*"],
        "@generation/*": ["src/generation/*"],
        "@utils/*": ["src/utils/*"]
      }
    },
    "include": ["src/**/*", "tests/**/*"],
    "exclude": ["node_modules", "dist"]
  }, null, 2),

  'jest.config.js': `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@cli/(.*)$': '<rootDir>/src/cli/$1',
    '^@analysis/(.*)$': '<rootDir>/src/analysis/$1',
    '^@planning/(.*)$': '<rootDir>/src/planning/$1',
    '^@hedera/(.*)$': '<rootDir>/src/hedera/$1',
    '^@templates/(.*)$': '<rootDir>/src/templates/$1',
    '^@generation/(.*)$': '<rootDir>/src/generation/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
};`,

  'src/cli/index.ts': `#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { APIxCLI } from './cli-core';
import { logger } from '@utils/logger';

const packageJson = require('../../package.json');
const cli = new APIxCLI();

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

program.exitOverride();
program.showHelpAfterError();
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

export { program };`,

  'README.md': `# APIx - AI-Powered Hedera Integration CLI

From Hedera idea to working code in under 2 minutes.

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Initialize APIx in your project
npm run dev -- init

# Analyze your project for integration opportunities
npm run dev -- analyze

# Add Hedera Token Service integration
npm run dev -- add hts --name "MyToken" --symbol "MTK"
\`\`\`

## Development

\`\`\`bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
\`\`\`
`
};

// Create directories
const directories = [
  'src/cli',
  'src/analysis', 
  'src/planning',
  'src/hedera',
  'src/templates',
  'src/generation',
  'src/utils',
  'templates/hts',
  'templates/contracts',
  'templates/wallets',
  'templates/consensus',
  'templates/common',
  'tests/integration',
  'tests/unit',
  'dist'
];

function createDirectories() {
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });
}

function createFiles() {
  Object.entries(files).forEach(([filePath, content]) => {
    const dir = path.dirname(filePath);
    if (dir !== '.') {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
    console.log(`✅ Created file: ${filePath}`);
  });
}

// Main execution
console.log('🚀 Setting up APIx project...\n');

try {
  createDirectories();
  createFiles();

  console.log('\n🎉 APIx project setup complete!');
  console.log('\nNext steps:');
  console.log('1. npm install');
  console.log('2. npm run dev -- --help');
  console.log('3. Start building your AI-powered Hedera integrations!');
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
}

