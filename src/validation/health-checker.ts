import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ProjectContext } from '../types';
import { EnvironmentValidator, HEDERA_CREDENTIALS_HELP } from '../utils/environment-validator';

export interface HealthCheckResult {
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string[];
  fixSuggestion?: string;
}

export interface HealthCheckReport {
  overall: 'healthy' | 'issues' | 'critical';
  timestamp: string;
  checks: { [key: string]: HealthCheckResult };
  score: number; // 0-100
  criticalIssues: number;
  warnings: number;
}

export type HealthAreaStatus = 'ok' | 'not configured' | 'error';

export interface HealthArea {
  name: string;
  status: HealthAreaStatus;
  message: string;
  hint?: string;
}

// Values copied unchanged from .env.example, e.g. "sk-ant-..." or "your-...-id"
function looksLikePlaceholder(value: string): boolean {
  return /your-|\.\.\.|x{4,}/i.test(value);
}

export class HealthChecker {
  private context: ProjectContext;

  constructor(context: ProjectContext) {
    this.context = context;
  }

  async runCompleteHealthCheck(): Promise<HealthCheckReport> {
    const checks: { [key: string]: HealthCheckResult } = {};

    // Core checks
    checks['project-structure'] = await this.checkProjectStructure();
    checks['package-json'] = await this.checkPackageJson();
    checks['dependencies'] = await this.checkDependencies();
    checks['typescript'] = await this.checkTypeScript();

    // Hedera-specific checks
    checks['hedera-sdk'] = await this.checkHederaSDK();
    checks['environment'] = await this.checkEnvironmentConfiguration();

    // Integration-specific checks
    checks['hts-integration'] = await this.checkHTSIntegration();
    checks['wallet-integration'] = await this.checkWalletIntegration();
    checks['api-routes'] = await this.checkAPIRoutes();
    checks['components'] = await this.checkComponents();

    // Build and compilation checks
    checks['typescript-compilation'] = await this.checkTypeScriptCompilation();
    checks['build-system'] = await this.checkBuildSystem();

    // Calculate overall health score
    const results = Object.values(checks);
    const passCount = results.filter(r => r.status === 'pass').length;
    const warnCount = results.filter(r => r.status === 'warning').length;
    const failCount = results.filter(r => r.status === 'fail').length;
    
    const score = Math.round(((passCount + warnCount * 0.5) / results.length) * 100);
    const overall = failCount > 0 ? 'critical' : warnCount > 0 ? 'issues' : 'healthy';

    return {
      overall,
      timestamp: new Date().toISOString(),
      checks,
      score,
      criticalIssues: failCount,
      warnings: warnCount
    };
  }

  private async checkProjectStructure(): Promise<HealthCheckResult> {
    const requiredFiles = ['package.json'];
    
    // Context-aware recommended directories
    let recommendedDirs: string[] = ['src'];
    
    // Add framework-specific recommendations
    if (this.context.framework === 'react' || this.context.framework === 'next.js') {
      recommendedDirs.push('components');
    } else if (this.context.framework === 'node') {
      // For CLI tools and Node.js projects, recommend utils and lib instead
      recommendedDirs.push('lib', 'utils');
    } else {
      // For other frameworks, include components and lib
      recommendedDirs.push('components', 'lib');
    }
    
    const missing: string[] = [];
    const missingRecommended: string[] = [];

    for (const file of requiredFiles) {
      if (!await fs.pathExists(path.join(this.context.rootPath, file))) {
        missing.push(file);
      }
    }

    for (const dir of recommendedDirs) {
      if (!await fs.pathExists(path.join(this.context.rootPath, dir))) {
        missingRecommended.push(dir);
      }
    }

    if (missing.length > 0) {
      return {
        status: 'fail',
        message: 'Critical project files missing',
        details: missing,
        fixSuggestion: 'Ensure you are in the correct project directory and have a valid project structure'
      };
    }

    if (missingRecommended.length > 0) {
      // Context-aware messaging
      const contextMessage = this.context.framework === 'node' 
        ? 'Some recommended directories are missing for CLI/Node.js projects'
        : 'Some recommended directories are missing';
        
      const contextSuggestion = this.context.framework === 'node'
        ? 'Consider creating standard directories for better CLI tool organization'
        : 'Consider creating standard project directories for better organization';
        
      return {
        status: 'warning',
        message: contextMessage,
        details: missingRecommended,
        fixSuggestion: contextSuggestion
      };
    }

    return {
      status: 'pass',
      message: `Project structure is valid for ${this.context.framework} project`
    };
  }

  private async checkPackageJson(): Promise<HealthCheckResult> {
    const packagePath = path.join(this.context.rootPath, 'package.json');
    
    try {
      const packageJson = await fs.readJson(packagePath);
      const issues: string[] = [];

      if (!packageJson.name) issues.push('Missing package name');
      if (!packageJson.version) issues.push('Missing version');
      if (!packageJson.scripts) issues.push('No scripts defined');
      if (!packageJson.dependencies && !packageJson.devDependencies) {
        issues.push('No dependencies defined');
      }

      // Check for required scripts based on framework
      if (this.context.framework === 'next.js') {
        if (!packageJson.scripts?.dev && !packageJson.scripts?.start) {
          issues.push('Missing dev/start script for Next.js');
        }
      }

      if (issues.length > 0) {
        return {
          status: 'warning',
          message: 'Package.json has some issues',
          details: issues,
          fixSuggestion: 'Update package.json with missing fields'
        };
      }

      return {
        status: 'pass',
        message: 'Package.json is properly configured'
      };

    } catch (error) {
      return {
        status: 'fail',
        message: 'Cannot read package.json',
        fixSuggestion: 'Ensure package.json exists and is valid JSON'
      };
    }
  }

  private async checkDependencies(): Promise<HealthCheckResult> {
    try {
      const packagePath = path.join(this.context.rootPath, 'package.json');
      const packageJson = await fs.readJson(packagePath);
      
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      const issues: string[] = [];
      const warnings: string[] = [];

      // Check for Hedera SDK
      if (!allDeps['@hiero-ledger/sdk']) {
        issues.push('Missing @hiero-ledger/sdk - required for Hedera integration');
      }

      // Check for framework dependencies
      if (this.context.framework === 'next.js') {
        if (!allDeps['next']) issues.push('Missing Next.js dependency');
        if (!allDeps['react']) issues.push('Missing React dependency');
      } else if (this.context.framework === 'react') {
        if (!allDeps['react']) issues.push('Missing React dependency');
      }

      // Check for TypeScript if used
      if (this.context.language === 'typescript') {
        if (!allDeps['typescript'] && !allDeps['@types/node']) {
          warnings.push('TypeScript types may be missing');
        }
      }

      if (issues.length > 0) {
        return {
          status: 'fail',
          message: 'Critical dependencies missing',
          details: issues,
          fixSuggestion: 'Run npm install to install missing dependencies'
        };
      }

      if (warnings.length > 0) {
        return {
          status: 'warning',
          message: 'Some dependencies may be missing',
          details: warnings,
          fixSuggestion: 'Consider installing recommended dependencies'
        };
      }

      return {
        status: 'pass',
        message: 'All required dependencies are installed'
      };

    } catch (error) {
      return {
        status: 'fail',
        message: 'Cannot check dependencies',
        fixSuggestion: 'Ensure package.json is valid and readable'
      };
    }
  }

  private async checkTypeScript(): Promise<HealthCheckResult> {
    if (this.context.language !== 'typescript') {
      return {
        status: 'pass',
        message: 'TypeScript not used in this project'
      };
    }

    const tsconfigPath = path.join(this.context.rootPath, 'tsconfig.json');
    
    if (!await fs.pathExists(tsconfigPath)) {
      return {
        status: 'fail',
        message: 'TypeScript project but no tsconfig.json found',
        fixSuggestion: 'Create a tsconfig.json file or run npx tsc --init'
      };
    }

    try {
      const tsconfig = await fs.readJson(tsconfigPath);
      const warnings: string[] = [];

      if (!tsconfig.compilerOptions) {
        warnings.push('No compiler options defined');
      } else {
        const opts = tsconfig.compilerOptions;
        if (!opts.strict && !opts.noImplicitAny) {
          warnings.push('Consider enabling strict mode for better type safety');
        }
        if (!opts.esModuleInterop) {
          warnings.push('Consider enabling esModuleInterop for better imports');
        }
      }

      return {
        status: warnings.length > 0 ? 'warning' : 'pass',
        message: warnings.length > 0 ? 'TypeScript configuration could be improved' : 'TypeScript is properly configured',
        details: warnings.length > 0 ? warnings : undefined,
        fixSuggestion: warnings.length > 0 ? 'Update tsconfig.json with recommended settings' : undefined
      };

    } catch (error) {
      return {
        status: 'fail',
        message: 'Invalid tsconfig.json',
        fixSuggestion: 'Fix tsconfig.json syntax errors'
      };
    }
  }

  private async checkHederaSDK(): Promise<HealthCheckResult> {
    try {
      const packagePath = path.join(this.context.rootPath, 'package.json');
      const packageJson = await fs.readJson(packagePath);
      const hederaSdkDeclared = packageJson.dependencies?.['@hiero-ledger/sdk'] || 
                               packageJson.devDependencies?.['@hiero-ledger/sdk'];

      if (!hederaSdkDeclared) {
        return {
          status: 'fail',
          message: 'Hedera SDK not declared in dependencies',
          fixSuggestion: 'Run: npm install @hiero-ledger/sdk'
        };
      }

      // Check actual installed version from node_modules
      let actualVersion: string;
      try {
        const installedPackagePath = path.join(this.context.rootPath, 'node_modules', '@hiero-ledger', 'sdk', 'package.json');
        const installedPackage = await fs.readJson(installedPackagePath);
        actualVersion = installedPackage.version;
      } catch (nodeModulesError) {
        // Fallback: try to parse declared version if node_modules check fails
        if (hederaSdkDeclared === 'latest') {
          return {
            status: 'pass',
            message: 'Hedera SDK set to latest version',
            details: [`Declared version: ${hederaSdkDeclared}`, 'Actual version: Unable to determine from node_modules'],
            fixSuggestion: 'Run npm install to ensure latest version is installed'
          };
        }
        
        const versionOnly = hederaSdkDeclared.replace(/[^\d.]/g, '');
        actualVersion = versionOnly;
      }

      // Parse version numbers
      const versionMatch = actualVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
      if (!versionMatch) {
        return {
          status: 'warning',
          message: 'Cannot parse Hedera SDK version',
          details: [`Declared: ${hederaSdkDeclared}`, `Found: ${actualVersion}`],
          fixSuggestion: 'Reinstall: npm install @hiero-ledger/sdk@latest'
        };
      }

      const [, major, minor, patch] = versionMatch;
      const majorNum = parseInt(major, 10);
      const minorNum = parseInt(minor, 10);
      
      // Check if version meets minimum requirement (>= 2.40.0)
      if (majorNum < 2 || (majorNum === 2 && minorNum < 40)) {
        return {
          status: 'warning',
          message: 'Hedera SDK version may be outdated',
          details: [
            `Declared: ${hederaSdkDeclared}`,
            `Installed: ${actualVersion}`,
            'Recommended: >= 2.40.0'
          ],
          fixSuggestion: 'Update to latest version: npm install @hiero-ledger/sdk@latest'
        };
      }

      return {
        status: 'pass',
        message: 'Hedera SDK is properly installed and up to date',
        details: [
          `Declared: ${hederaSdkDeclared}`,
          `Installed: ${actualVersion}`
        ]
      };

    } catch (error) {
      return {
        status: 'fail',
        message: 'Cannot verify Hedera SDK installation',
        fixSuggestion: 'Check package.json and run npm install'
      };
    }
  }

  private async checkEnvironmentConfiguration(): Promise<HealthCheckResult> {
    const envFiles = ['.env.local', '.env', '.env.development'];
    const foundEnvFile = envFiles.find(file => 
      fs.existsSync(path.join(this.context.rootPath, file))
    );

    if (!foundEnvFile) {
      return {
        status: 'warning',
        message: 'No environment configuration file found',
        details: ['Environment variables should be configured for Hedera credentials'],
        fixSuggestion: 'Create .env.local with HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY'
      };
    }

    try {
      const envPath = path.join(this.context.rootPath, foundEnvFile);
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      const hasHederaConfig = envContent.includes('HEDERA_') || 
                             envContent.includes('ACCOUNT_ID') ||
                             envContent.includes('PRIVATE_KEY');

      if (!hasHederaConfig) {
        return {
          status: 'warning',
          message: 'Environment file exists but no Hedera configuration found',
          details: ['Add HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY to ' + foundEnvFile],
          fixSuggestion: 'Configure Hedera credentials in environment file'
        };
      }

      return {
        status: 'pass',
        message: `Environment configuration found in ${foundEnvFile}`
      };

    } catch (error) {
      return {
        status: 'warning',
        message: 'Cannot read environment file',
        fixSuggestion: 'Ensure environment file is readable'
      };
    }
  }

  private async checkHTSIntegration(): Promise<HealthCheckResult> {
    const htsFiles = [
      'lib/hedera/hts-operations.ts',
      'lib/hedera/hts-operations.js',
      'src/lib/hedera/hts-operations.ts',
      'src/lib/hedera/hts-operations.js'
    ];

    const foundFile = htsFiles.find(file => 
      fs.existsSync(path.join(this.context.rootPath, file))
    );

    if (!foundFile) {
      return {
        status: 'pass',
        message: 'HTS integration not detected (optional)'
      };
    }

    try {
      const filePath = path.join(this.context.rootPath, foundFile);
      const content = await fs.readFile(filePath, 'utf-8');
      
      const checks = [
        { pattern: 'TokenCreateTransaction', name: 'Token creation functionality' },
        { pattern: 'TokenMintTransaction', name: 'Token minting functionality' },
        { pattern: 'TokenTransferTransaction|TransferTransaction', name: 'Token transfer functionality' },
        { pattern: '@hiero-ledger/sdk', name: 'Hedera SDK import' }
      ];

      const missing: string[] = [];
      checks.forEach(check => {
        if (!new RegExp(check.pattern).test(content)) {
          missing.push(check.name);
        }
      });

      if (missing.length > 0) {
        return {
          status: 'warning',
          message: 'HTS integration may be incomplete',
          details: missing.map(m => `Missing: ${m}`),
          fixSuggestion: 'Regenerate HTS integration: apix add hts'
        };
      }

      return {
        status: 'pass',
        message: 'HTS integration appears complete'
      };

    } catch (error) {
      return {
        status: 'fail',
        message: 'Cannot analyze HTS integration files',
        fixSuggestion: 'Check file permissions and content'
      };
    }
  }

  private async checkWalletIntegration(): Promise<HealthCheckResult> {
    // Check for APIX AI wallet integration service (primary location)
    const apixWalletFiles = [
      'src/services/wallet-integration.ts',
      'src/services/wallet-integration.js'
    ];

    // Check for user-generated wallet files (secondary locations)
    const userWalletFiles = [
      'lib/hedera/wallet-service.ts',
      'lib/hedera/wallet-service.js',
      'src/lib/hedera/wallet-service.ts',
      'src/lib/hedera/wallet-service.js',
      'contexts/WalletContext.tsx',
      'src/contexts/WalletContext.tsx'
    ];

    const foundApixFiles = apixWalletFiles.filter(file => 
      fs.existsSync(path.join(this.context.rootPath, file))
    );

    const foundUserFiles = userWalletFiles.filter(file => 
      fs.existsSync(path.join(this.context.rootPath, file))
    );

    // If APIX wallet service exists, analyze its capabilities
    if (foundApixFiles.length > 0) {
      try {
        const walletServicePath = path.join(this.context.rootPath, foundApixFiles[0]);
        const walletServiceContent = await fs.readFile(walletServicePath, 'utf-8');
        
        const supportedWallets: string[] = [];
        if (walletServiceContent.includes('hashpack')) supportedWallets.push('HashPack');
        if (walletServiceContent.includes('blade')) supportedWallets.push('Blade');
        if (walletServiceContent.includes('walletconnect') || walletServiceContent.includes('WalletConnect')) {
          supportedWallets.push('WalletConnect');
        }
        if (walletServiceContent.includes('metamask') || walletServiceContent.includes('MetaMask')) {
          supportedWallets.push('MetaMask');
        }

        if (supportedWallets.length > 0) {
          return {
            status: 'pass',
            message: `Wallet integration detected with ${supportedWallets.length} provider(s)`,
            details: [`Supported wallets: ${supportedWallets.join(', ')}`, `Service file: ${foundApixFiles[0]}`]
          };
        } else {
          return {
            status: 'warning',
            message: 'Wallet service exists but no wallet providers detected',
            details: [`Found: ${foundApixFiles[0]}`],
            fixSuggestion: 'Ensure wallet providers are properly configured'
          };
        }
      } catch (error) {
        return {
          status: 'warning',
          message: 'Wallet service exists but cannot be analyzed',
          details: [`Found: ${foundApixFiles[0]}`],
          fixSuggestion: 'Check wallet service file for syntax errors'
        };
      }
    }

    // Check user-generated wallet files
    if (foundUserFiles.length > 0) {
      const issues: string[] = [];
      
      // Check for wallet service
      const hasWalletService = foundUserFiles.some(f => f.includes('wallet-service'));
      if (!hasWalletService) {
        issues.push('Wallet service file missing');
      }

      // Check for wallet context
      const hasWalletContext = foundUserFiles.some(f => f.includes('WalletContext'));
      if (!hasWalletContext) {
        issues.push('Wallet context missing');
      }

      if (issues.length > 0) {
        return {
          status: 'warning',
          message: 'User wallet integration appears incomplete',
          details: issues,
          fixSuggestion: 'Regenerate wallet integration: apix add wallet'
        };
      }

      return {
        status: 'pass',
        message: 'User wallet integration detected',
        details: [`Found files: ${foundUserFiles.join(', ')}`]
      };
    }

    // No wallet integration found
    return {
      status: 'pass',
      message: 'Wallet integration not detected (optional)'
    };
  }

  private async checkAPIRoutes(): Promise<HealthCheckResult> {
    if (this.context.framework !== 'next.js') {
      return {
        status: 'pass',
        message: 'API routes not applicable for this framework'
      };
    }

    const apiDirs = [
      'pages/api',
      'app/api',
      'src/pages/api',
      'src/app/api'
    ];

    const foundDir = apiDirs.find(dir => 
      fs.existsSync(path.join(this.context.rootPath, dir))
    );

    if (!foundDir) {
      return {
        status: 'pass',
        message: 'No API routes detected (optional)'
      };
    }

    try {
      const apiPath = path.join(this.context.rootPath, foundDir);
      const tokenApiPath = path.join(apiPath, 'tokens');
      
      if (fs.existsSync(tokenApiPath)) {
        const tokenRoutes = await fs.readdir(tokenApiPath);
        const expectedRoutes = ['create', 'mint', 'transfer', 'info'];
        const missingRoutes = expectedRoutes.filter(route => 
          !tokenRoutes.some(file => file.includes(route))
        );

        if (missingRoutes.length > 0) {
          return {
            status: 'warning',
            message: 'Some token API routes may be missing',
            details: missingRoutes.map(r => `Missing: ${r} route`),
            fixSuggestion: 'Regenerate HTS integration to create missing routes'
          };
        }
      }

      return {
        status: 'pass',
        message: 'API routes appear to be properly configured'
      };

    } catch (error) {
      return {
        status: 'warning',
        message: 'Cannot analyze API routes structure',
        fixSuggestion: 'Check API directory permissions'
      };
    }
  }

  private async checkComponents(): Promise<HealthCheckResult> {
    const componentDirs = [
      'components',
      'src/components'
    ];

    const foundDir = componentDirs.find(dir => 
      fs.existsSync(path.join(this.context.rootPath, dir))
    );

    if (!foundDir) {
      return {
        status: 'pass',
        message: 'No components directory found (may be organized differently)'
      };
    }

    try {
      const componentsPath = path.join(this.context.rootPath, foundDir);
      const files = await fs.readdir(componentsPath, { withFileTypes: true });
      
      const componentFiles = files.filter(f => 
        f.isFile() && (f.name.endsWith('.tsx') || f.name.endsWith('.jsx'))
      ).map(f => f.name);

      const hederaComponents = componentFiles.filter(f => 
        f.toLowerCase().includes('token') || 
        f.toLowerCase().includes('wallet') ||
        f.toLowerCase().includes('hedera')
      );

      if (hederaComponents.length === 0) {
        return {
          status: 'pass',
          message: 'No Hedera-specific components detected (optional)'
        };
      }

      return {
        status: 'pass',
        message: `Found ${hederaComponents.length} Hedera-related components`,
        details: hederaComponents
      };

    } catch (error) {
      return {
        status: 'warning',
        message: 'Cannot analyze components directory',
        fixSuggestion: 'Check components directory permissions'
      };
    }
  }

  private async checkTypeScriptCompilation(): Promise<HealthCheckResult> {
    if (this.context.language !== 'typescript') {
      return {
        status: 'pass',
        message: 'TypeScript compilation not applicable'
      };
    }

    try {
      // Try to run TypeScript compiler check
      const result = execSync('npx tsc --noEmit', {
        cwd: this.context.rootPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      return {
        status: 'pass',
        message: 'TypeScript compiles without errors'
      };

    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || '';
      const errorLines = errorOutput.split('\n').filter((line: string) => line.trim());
      
      return {
        status: 'fail',
        message: 'TypeScript compilation errors detected',
        details: errorLines.slice(0, 5), // Show first 5 errors
        fixSuggestion: 'Fix TypeScript errors before proceeding'
      };
    }
  }

  private async checkBuildSystem(): Promise<HealthCheckResult> {
    const packagePath = path.join(this.context.rootPath, 'package.json');
    
    try {
      const packageJson = await fs.readJson(packagePath);
      const scripts = packageJson.scripts || {};

      if (this.context.framework === 'next.js') {
        if (!scripts.build && !scripts['build:next']) {
          return {
            status: 'warning',
            message: 'No build script found for Next.js',
            fixSuggestion: 'Add "build": "next build" to package.json scripts'
          };
        }
      }

      return {
        status: 'pass',
        message: 'Build system appears to be configured'
      };

    } catch (error) {
      return {
        status: 'warning',
        message: 'Cannot verify build system configuration',
        fixSuggestion: 'Ensure package.json has proper scripts defined'
      };
    }
  }

  // Format health report for display
  formatHealthReport(report: HealthCheckReport): string {
    const lines: string[] = [];
    
    // Header
    const statusIcon = report.overall === 'healthy' ? '✅' : 
                      report.overall === 'issues' ? '⚠️' : '❌';
    
    lines.push(chalk.bold(`\n${statusIcon} Health Check Report`));
    lines.push(chalk.gray(`Generated: ${new Date(report.timestamp).toLocaleString()}`));
    lines.push(chalk.cyan(`Overall Score: ${report.score}/100`));
    
    if (report.criticalIssues > 0) {
      lines.push(chalk.red(`Critical Issues: ${report.criticalIssues}`));
    }
    
    if (report.warnings > 0) {
      lines.push(chalk.yellow(`Warnings: ${report.warnings}`));
    }

    lines.push('');

    // Individual checks
    Object.entries(report.checks).forEach(([name, result]) => {
      const icon = result.status === 'pass' ? '✅' : 
                  result.status === 'warning' ? '⚠️' : '❌';
      
      lines.push(`${icon} ${chalk.bold(name)}: ${result.message}`);
      
      if (result.details && result.details.length > 0) {
        result.details.forEach(detail => {
          lines.push(chalk.gray(`   • ${detail}`));
        });
      }
      
      if (result.fixSuggestion) {
        lines.push(chalk.blue(`   💡 ${result.fixSuggestion}`));
      }
      
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * One status per area, for `apix health`. Needs no keys and makes no
   * network calls: credentials are checked for presence and format only.
   */
  async checkAreas(): Promise<HealthArea[]> {
    return [
      await this.checkProjectArea(),
      await this.checkDependenciesArea(),
      await this.checkSdkArea(),
      this.checkHederaCredentialsArea(),
      this.checkAIKeyArea(),
      this.checkWalletConnectArea()
    ];
  }

  private async readPackageJson(): Promise<any | null> {
    const packagePath = path.join(this.context.rootPath, 'package.json');
    if (!await fs.pathExists(packagePath)) return null;
    return fs.readJson(packagePath);
  }

  private async checkProjectArea(): Promise<HealthArea> {
    try {
      const packageJson = await this.readPackageJson();
      if (!packageJson) {
        return { name: 'Project', status: 'error', message: `No package.json in ${this.context.rootPath}`, hint: 'Run apix from your project root' };
      }
      return { name: 'Project', status: 'ok', message: `${this.context.framework} project (${this.context.language})` };
    } catch (error: any) {
      return { name: 'Project', status: 'error', message: `Cannot read package.json: ${error.message}` };
    }
  }

  private async checkDependenciesArea(): Promise<HealthArea> {
    try {
      const packageJson = await this.readPackageJson();
      if (!packageJson) {
        return { name: 'Dependencies', status: 'error', message: 'No package.json, so no dependencies to check' };
      }
      const declared = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });
      if (declared.length === 0) {
        return { name: 'Dependencies', status: 'not configured', message: 'No dependencies declared' };
      }
      if (!await fs.pathExists(path.join(this.context.rootPath, 'node_modules'))) {
        return { name: 'Dependencies', status: 'error', message: `${declared.length} declared but not installed`, hint: 'Run npm install' };
      }
      return { name: 'Dependencies', status: 'ok', message: `${declared.length} declared, node_modules present` };
    } catch (error: any) {
      return { name: 'Dependencies', status: 'error', message: `Cannot read package.json: ${error.message}` };
    }
  }

  private async checkSdkArea(): Promise<HealthArea> {
    try {
      const packageJson = await this.readPackageJson();
      const declared = packageJson?.dependencies?.['@hiero-ledger/sdk'] || packageJson?.devDependencies?.['@hiero-ledger/sdk'];
      if (!declared) {
        return { name: 'Hedera SDK', status: 'not configured', message: '@hiero-ledger/sdk is not a dependency', hint: 'Run: apix add hts' };
      }
      const installedPath = path.join(this.context.rootPath, 'node_modules', '@hiero-ledger', 'sdk', 'package.json');
      if (!await fs.pathExists(installedPath)) {
        return { name: 'Hedera SDK', status: 'error', message: `@hiero-ledger/sdk ${declared} declared but not installed`, hint: 'Run npm install' };
      }
      const installed = (await fs.readJson(installedPath)).version;
      return { name: 'Hedera SDK', status: 'ok', message: `@hiero-ledger/sdk ${installed} installed (declared ${declared})` };
    } catch (error: any) {
      return { name: 'Hedera SDK', status: 'error', message: `Cannot check @hiero-ledger/sdk: ${error.message}` };
    }
  }

  private checkHederaCredentialsArea(): HealthArea {
    if (!EnvironmentValidator.hasHederaCredentials()) {
      return { name: 'Hedera credentials', status: 'not configured', message: 'HEDERA_ACCOUNT_ID / HEDERA_PRIVATE_KEY not set', hint: HEDERA_CREDENTIALS_HELP.split('\n').join(' ') };
    }
    try {
      const { accountId } = EnvironmentValidator.requireHederaCredentials();
      const network = process.env.HEDERA_NETWORK || 'testnet';
      return { name: 'Hedera credentials', status: 'ok', message: `${accountId} on ${network} (format checked, not verified against the network)` };
    } catch (error: any) {
      return { name: 'Hedera credentials', status: 'error', message: error.message.split('\n').slice(0, -2).join(' ').trim() };
    }
  }

  private checkAIKeyArea(): HealthArea {
    const providers = [
      process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY' : null,
      process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY' : null
    ].filter((name): name is string => name !== null);
    if (providers.length === 0) {
      return { name: 'AI key', status: 'not configured', message: 'ANTHROPIC_API_KEY / OPENAI_API_KEY not set', hint: 'Needed for chat, generate, recommend, explain, compare, confidence and debug (and the experimental compose)' };
    }
    const placeholders = providers.filter(name => looksLikePlaceholder(process.env[name]!));
    if (placeholders.length > 0) {
      return { name: 'AI key', status: 'error', message: `${placeholders.join(', ')} still has the .env.example placeholder value` };
    }
    return { name: 'AI key', status: 'ok', message: `${providers.join(', ')} set (not verified)` };
  }

  private checkWalletConnectArea(): HealthArea {
    const projectId = process.env.WALLETCONNECT_PROJECT_ID;
    if (!projectId) {
      return { name: 'WalletConnect project ID', status: 'not configured', message: 'WALLETCONNECT_PROJECT_ID not set', hint: 'Get one at https://cloud.reown.com' };
    }
    if (looksLikePlaceholder(projectId)) {
      return { name: 'WalletConnect project ID', status: 'error', message: 'WALLETCONNECT_PROJECT_ID still has the .env.example placeholder value', hint: 'Get one at https://cloud.reown.com' };
    }
    return { name: 'WalletConnect project ID', status: 'ok', message: 'WALLETCONNECT_PROJECT_ID set (not verified)' };
  }

  /**
   * Overall readiness line derived from the areas.
   */
  static summarizeAreas(areas: HealthArea[]): string {
    if (areas.some(area => area.status === 'error')) {
      return 'Not ready: fix the errors above';
    }
    const hedera = areas.find(area => area.name === 'Hedera credentials');
    return hedera?.status === 'ok'
      ? 'Ready for blockchain operations'
      : 'Ready for local use (blockchain operations need Hedera credentials)';
  }

  /**
   * `apix health` exits 0 by default; with --strict, 1 unless every area is ok.
   */
  static exitCode(areas: HealthArea[], strict: boolean): number {
    return strict && areas.some(area => area.status !== 'ok') ? 1 : 0;
  }

  static formatAreas(areas: HealthArea[]): string {
    const icons: Record<HealthAreaStatus, string> = { 'ok': '✅', 'not configured': '⚪', 'error': '❌' };
    const colors: Record<HealthAreaStatus, (text: string) => string> = { 'ok': chalk.green, 'not configured': chalk.gray, 'error': chalk.red };
    const width = Math.max(...areas.map(area => area.name.length));
    const lines = [chalk.bold('\nHealth by area')];
    for (const area of areas) {
      lines.push(`${icons[area.status]} ${area.name.padEnd(width)}  ${colors[area.status](area.status.padEnd(14))} ${area.message}`);
      if (area.hint && area.status !== 'ok') {
        lines.push(chalk.gray(`   ${' '.repeat(width)}  ${area.hint}`));
      }
    }
    lines.push('');
    lines.push(chalk.bold(HealthChecker.summarizeAreas(areas)));
    return lines.join('\n');
  }
}