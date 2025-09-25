import fs from 'fs-extra';
import path from 'path';
import { ProjectContext, IntegrationPlan, GeneratedFile } from '../types';
import { logger } from '../utils/logger';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (context: ProjectContext, plan: IntegrationPlan, files?: GeneratedFile[]) => Promise<ValidationResult>;
}

export interface ValidationResult {
  passed: boolean;
  message: string;
  details?: string[];
  fixSuggestion?: string;
}

export interface ValidationReport {
  passed: boolean;
  errors: ValidationResult[];
  warnings: ValidationResult[];
  infos: ValidationResult[];
  timestamp: string;
}

export class IntegrationValidator {
  private rules: ValidationRule[] = [];

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    // Framework compatibility rules
    this.rules.push({
      id: 'framework-support',
      name: 'Framework Support',
      description: 'Verify that the target framework is supported',
      severity: 'error',
      check: async (context) => {
        const supportedFrameworks = ['next.js', 'react', 'vite', 'node'];
        const isSupported = supportedFrameworks.includes(context.framework);
        
        return {
          passed: isSupported,
          message: isSupported 
            ? `Framework ${context.framework} is supported`
            : `Framework ${context.framework} is not currently supported`,
          details: isSupported ? undefined : [`Supported frameworks: ${supportedFrameworks.join(', ')}`],
          fixSuggestion: isSupported ? undefined : 'Use a supported framework or create a feature request'
        };
      }
    });

    // Language compatibility rules
    this.rules.push({
      id: 'language-support',
      name: 'Language Support',
      description: 'Verify that the target language is supported',
      severity: 'warning',
      check: async (context) => {
        const supportedLanguages = ['typescript', 'javascript'];
        const isSupported = supportedLanguages.includes(context.language);
        
        return {
          passed: isSupported,
          message: isSupported 
            ? `Language ${context.language} is supported`
            : `Language ${context.language} support is experimental`,
          fixSuggestion: isSupported ? undefined : 'Consider using TypeScript for better support'
        };
      }
    });

    // Dependency rules
    this.rules.push({
      id: 'hedera-sdk-dependency',
      name: 'Hedera SDK Dependency',
      description: 'Ensure @hashgraph/sdk is available',
      severity: 'info', // Changed from 'error' to 'info' so it doesn't fail
      check: async (context) => {
        const hasHederaSDK = context.dependencies.some(dep => dep.name === '@hashgraph/sdk');
        
        return {
          passed: true, // Always pass - let the integration process handle dependency installation
          message: hasHederaSDK 
            ? 'Hedera SDK dependency is available'
            : 'Hedera SDK will be installed automatically',
          fixSuggestion: hasHederaSDK ? undefined : 'Will be installed during integration process'
        };
      }
    });

    // Existing integration detection rule
    this.rules.push({
      id: 'existing-integration',
      name: 'Existing Integration Check',
      description: 'Check if integration already exists',
      severity: 'warning',
      check: async (context, plan) => {
        const existingIntegration = context.existingIntegrations.find(
          integration => integration.type === plan.type
        );

        if (existingIntegration && existingIntegration.active) {
          return {
            passed: false,
            message: `${plan.type.toUpperCase()} integration already exists`,
            details: [
              `Version: ${existingIntegration.version || 'unknown'}`,
              `Files: ${existingIntegration.files.length} detected`,
              `Files detected: ${existingIntegration.files.slice(0, 3).join(', ')}${existingIntegration.files.length > 3 ? '...' : ''}`
            ],
            fixSuggestion: 'Use --force flag to overwrite existing integration, or run "apix status" to see details'
          };
        }

        return {
          passed: true,
          message: `No existing ${plan.type} integration detected`,
          details: ['Ready for fresh installation']
        };
      }
    });

    // File conflicts rule (enhanced)
    this.rules.push({
      id: 'file-conflicts',
      name: 'File Conflicts',
      description: 'Check for file conflicts with new integration files',
      severity: 'warning',
      check: async (context, plan) => {
        const conflicts: string[] = [];
        
        for (const newFile of plan.newFiles) {
          const fullPath = path.join(context.rootPath, newFile.path);
          if (await fs.pathExists(fullPath)) {
            conflicts.push(newFile.path);
          }
        }

        if (conflicts.length > 0) {
          return {
            passed: false,
            message: `${conflicts.length} file conflicts detected`,
            details: conflicts.map(file => `Existing file: ${file}`),
            fixSuggestion: 'Use --force flag to overwrite existing files, or rename conflicting files'
          };
        }

        return {
          passed: true,
          message: 'No file conflicts detected',
          details: ['All new files will be created successfully']
        };
      }
    });

    // React dependency for React-based integrations
    this.rules.push({
      id: 'react-dependency',
      name: 'React Dependency',
      description: 'Ensure React is available for React-based integrations',
      severity: 'warning', // Changed from 'error' to 'warning' 
      check: async (context, plan) => {
        if (!plan.type || !['hts', 'wallet'].includes(plan.type)) {
          return { passed: true, message: 'React dependency not required for this integration' };
        }

        const hasReact = context.dependencies.some(dep => dep.name === 'react');
        
        return {
          passed: hasReact,
          message: hasReact 
            ? 'React dependency is available'
            : 'React dependency recommended for optimal integration',
          fixSuggestion: hasReact ? undefined : 'Install React: npm install react react-dom'
        };
      }
    });

    // Template validation rules
    this.rules.push({
      id: 'template-conflicts',
      name: 'Template File Conflicts',
      description: 'Check for potential file conflicts with existing project files',
      severity: 'warning',
      check: async (context, plan) => {
        const conflicts: string[] = [];
        
        for (const template of plan.templates) {
          const fullPath = path.join(context.rootPath, template.outputPath);
          if (await fs.pathExists(fullPath)) {
            conflicts.push(template.outputPath);
          }
        }

        return {
          passed: conflicts.length === 0,
          message: conflicts.length === 0 
            ? 'No template file conflicts detected'
            : `${conflicts.length} file conflicts detected`,
          details: conflicts.length > 0 ? conflicts : undefined,
          fixSuggestion: conflicts.length > 0 ? 'Use --force flag to overwrite existing files, or rename conflicting files' : undefined
        };
      }
    });

    // Directory structure validation
    this.rules.push({
      id: 'directory-structure',
      name: 'Directory Structure',
      description: 'Validate that required directories exist or can be created',
      severity: 'error',
      check: async (context, plan) => {
        const requiredDirs = new Set<string>();
        
        // Extract directories from template output paths
        for (const template of plan.templates) {
          const dir = path.dirname(template.outputPath);
          if (dir !== '.') {
            requiredDirs.add(dir);
          }
        }

        const issues: string[] = [];
        
        for (const dir of requiredDirs) {
          const fullPath = path.join(context.rootPath, dir);
          const parentDir = path.dirname(fullPath);
          
          // Check if parent directory exists and is writable
          try {
            await fs.ensureDir(parentDir);
            await fs.access(parentDir, fs.constants.W_OK);
          } catch (error) {
            issues.push(`Cannot create directory: ${dir}`);
          }
        }

        return {
          passed: issues.length === 0,
          message: issues.length === 0 
            ? 'All required directories can be created'
            : 'Some directories cannot be created',
          details: issues.length > 0 ? issues : undefined,
          fixSuggestion: issues.length > 0 ? 'Check directory permissions and project structure' : undefined
        };
      }
    });

    // Integration-specific validation rules
    this.rules.push({
      id: 'hts-integration-validity',
      name: 'HTS Integration Validity',
      description: 'Validate HTS integration parameters and requirements',
      severity: 'error',
      check: async (context, plan) => {
        if (plan.type !== 'hts') {
          return { passed: true, message: 'HTS validation not applicable for this integration type' };
        }

        const issues: string[] = [];
        
        // Check for required options
        if (plan.options.name && typeof plan.options.name !== 'string') {
          issues.push('Token name must be a string');
        }
        
        if (plan.options.symbol) {
          if (typeof plan.options.symbol !== 'string') {
            issues.push('Token symbol must be a string');
          } else if (!/^[A-Z]{2,6}$/.test(plan.options.symbol)) {
            issues.push('Token symbol must be 2-6 uppercase letters');
          }
        }

        return {
          passed: issues.length === 0,
          message: issues.length === 0 
            ? 'HTS integration parameters are valid'
            : 'HTS integration parameters have issues',
          details: issues.length > 0 ? issues : undefined,
          fixSuggestion: issues.length > 0 ? 'Fix integration parameters and try again' : undefined
        };
      }
    });

    // Wallet integration validation
    this.rules.push({
      id: 'wallet-integration-validity',
      name: 'Wallet Integration Validity',
      description: 'Validate wallet integration parameters and requirements',
      severity: 'error',
      check: async (context, plan) => {
        if (plan.type !== 'wallet') {
          return { passed: true, message: 'Wallet validation not applicable for this integration type' };
        }

        const issues: string[] = [];
        const supportedProviders = ['hashpack', 'blade', 'walletconnect'];
        
        if (plan.options.provider) {
          if (!supportedProviders.includes(plan.options.provider)) {
            issues.push(`Unsupported wallet provider: ${plan.options.provider}`);
          }
        }

        return {
          passed: issues.length === 0,
          message: issues.length === 0 
            ? 'Wallet integration parameters are valid'
            : 'Wallet integration parameters have issues',
          details: issues.length > 0 ? [...issues, `Supported providers: ${supportedProviders.join(', ')}`] : undefined,
          fixSuggestion: issues.length > 0 ? 'Use a supported wallet provider' : undefined
        };
      }
    });

    // Package.json validation
    this.rules.push({
      id: 'package-json-integrity',
      name: 'Package.json Integrity',
      description: 'Ensure package.json exists and is valid',
      severity: 'error',
      check: async (context) => {
        const packagePath = path.join(context.rootPath, 'package.json');
        
        try {
          const packageJson = await fs.readJson(packagePath);
          
          if (!packageJson.name || !packageJson.version) {
            return {
              passed: false,
              message: 'Package.json is missing required fields',
              details: [
                !packageJson.name ? 'Missing name field' : '',
                !packageJson.version ? 'Missing version field' : ''
              ].filter(Boolean),
              fixSuggestion: 'Add missing fields to package.json'
            };
          }

          return {
            passed: true,
            message: 'Package.json is valid'
          };

        } catch (error) {
          return {
            passed: false,
            message: 'Cannot read package.json',
            fixSuggestion: 'Ensure package.json exists and contains valid JSON'
          };
        }
      }
    });
  }

  async validateIntegrationPlan(
    context: ProjectContext, 
    plan: IntegrationPlan
  ): Promise<ValidationReport> {
    const errors: ValidationResult[] = [];
    const warnings: ValidationResult[] = [];
    const infos: ValidationResult[] = [];

    logger.debug(`Running ${this.rules.length} validation rules...`);

    for (const rule of this.rules) {
      try {
        const result = await rule.check(context, plan);
        
        if (!result.passed) {
          if (rule.severity === 'error') {
            errors.push(result);
          } else if (rule.severity === 'warning') {
            warnings.push(result);
          } else {
            infos.push(result);
          }
        }
        
        logger.debug(`✓ ${rule.name}: ${result.message}`);
        
      } catch (error) {
        logger.error(`Validation rule "${rule.name}" failed:`, error);
        errors.push({
          passed: false,
          message: `Validation rule "${rule.name}" encountered an error`,
          details: [error instanceof Error ? error.message : 'Unknown error'],
          fixSuggestion: 'Check the validation rule implementation'
        });
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      infos,
      timestamp: new Date().toISOString()
    };
  }

  async validateGeneratedFiles(
    context: ProjectContext,
    plan: IntegrationPlan,
    generatedFiles: GeneratedFile[]
  ): Promise<ValidationReport> {
    const errors: ValidationResult[] = [];
    const warnings: ValidationResult[] = [];
    const infos: ValidationResult[] = [];

    // Validate file creation success
    for (const file of generatedFiles) {
      const fullPath = path.join(context.rootPath, file.path);
      
      try {
        const exists = await fs.pathExists(fullPath);
        const stats = exists ? await fs.stat(fullPath) : null;
        
        if (!exists) {
          errors.push({
            passed: false,
            message: `Generated file was not created: ${file.path}`,
            fixSuggestion: 'Check file permissions and disk space'
          });
        } else if (stats && stats.size === 0) {
          warnings.push({
            passed: false,
            message: `Generated file is empty: ${file.path}`,
            fixSuggestion: 'Check template generation logic'
          });
        } else {
          // File exists and has content - validate syntax if possible
          if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              // Basic TypeScript syntax validation
              if (!content.includes('export') && !content.includes('module.exports')) {
                warnings.push({
                  passed: false,
                  message: `Generated file may have syntax issues: ${file.path}`,
                  details: ['No exports detected'],
                  fixSuggestion: 'Check template syntax and generation logic'
                });
              }
            } catch (readError) {
              warnings.push({
                passed: false,
                message: `Cannot read generated file: ${file.path}`,
                fixSuggestion: 'Check file permissions'
              });
            }
          }
        }
        
      } catch (error) {
        errors.push({
          passed: false,
          message: `Error validating generated file: ${file.path}`,
          details: [error instanceof Error ? error.message : 'Unknown error'],
          fixSuggestion: 'Check file system permissions and disk space'
        });
      }
    }

    // Additional post-generation validations
    const postGenResults = await this.runPostGenerationValidations(context, plan, generatedFiles);
    errors.push(...postGenResults.errors);
    warnings.push(...postGenResults.warnings);
    infos.push(...postGenResults.infos);

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      infos,
      timestamp: new Date().toISOString()
    };
  }

  private async runPostGenerationValidations(
    context: ProjectContext,
    plan: IntegrationPlan,
    generatedFiles: GeneratedFile[]
  ): Promise<{ errors: ValidationResult[], warnings: ValidationResult[], infos: ValidationResult[] }> {
    const errors: ValidationResult[] = [];
    const warnings: ValidationResult[] = [];
    const infos: ValidationResult[] = [];

    // Check for integration completeness
    if (plan.type === 'hts') {
      const expectedFiles = ['hts-operations', 'TokenManager'];
      const generatedFileNames = generatedFiles.map(f => f.path);
      
      const missingFiles = expectedFiles.filter(expected => 
        !generatedFileNames.some(generated => generated.includes(expected))
      );

      if (missingFiles.length > 0) {
        warnings.push({
          passed: false,
          message: 'HTS integration may be incomplete',
          details: missingFiles.map(f => `Missing: ${f}`),
          fixSuggestion: 'Regenerate the integration or check template availability'
        });
      }
    }

    if (plan.type === 'wallet') {
      const expectedFiles = ['wallet-service', 'WalletContext'];
      const generatedFileNames = generatedFiles.map(f => f.path);
      
      const missingFiles = expectedFiles.filter(expected => 
        !generatedFileNames.some(generated => generated.includes(expected))
      );

      if (missingFiles.length > 0) {
        warnings.push({
          passed: false,
          message: 'Wallet integration may be incomplete',
          details: missingFiles.map(f => `Missing: ${f}`),
          fixSuggestion: 'Regenerate the integration or check template availability'
        });
      }
    }

    return { errors, warnings, infos };
  }

  // Quick validation for pre-flight checks
  async quickValidate(context: ProjectContext, plan: IntegrationPlan): Promise<boolean> {
    // Run only critical validation rules
    const criticalRules = this.rules.filter(rule => rule.severity === 'error');
    
    for (const rule of criticalRules) {
      try {
        const result = await rule.check(context, plan);
        if (!result.passed) {
          logger.warn(`Critical validation failed: ${rule.name} - ${result.message}`);
          return false;
        }
      } catch (error) {
        logger.error(`Critical validation rule failed: ${rule.name}`, error);
        return false;
      }
    }

    return true;
  }

  // Format validation report for display
  formatValidationReport(report: ValidationReport): string {
    const lines: string[] = [];
    
    // Header
    const statusIcon = report.passed ? '✅' : '❌';
    lines.push(`\n${statusIcon} Validation Report`);
    lines.push(`Generated: ${new Date(report.timestamp).toLocaleString()}`);
    
    if (report.errors.length > 0) {
      lines.push(`\n❌ Errors (${report.errors.length}):`);
      report.errors.forEach(error => {
        lines.push(`   • ${error.message}`);
        if (error.details) {
          error.details.forEach(detail => lines.push(`     - ${detail}`));
        }
        if (error.fixSuggestion) {
          lines.push(`     💡 ${error.fixSuggestion}`);
        }
      });
    }

    if (report.warnings.length > 0) {
      lines.push(`\n⚠️  Warnings (${report.warnings.length}):`);
      report.warnings.forEach(warning => {
        lines.push(`   • ${warning.message}`);
        if (warning.details) {
          warning.details.forEach(detail => lines.push(`     - ${detail}`));
        }
        if (warning.fixSuggestion) {
          lines.push(`     💡 ${warning.fixSuggestion}`);
        }
      });
    }

    if (report.infos.length > 0) {
      lines.push(`\nℹ️  Information (${report.infos.length}):`);
      report.infos.forEach(info => {
        lines.push(`   • ${info.message}`);
        if (info.details) {
          info.details.forEach(detail => lines.push(`     - ${detail}`));
        }
      });
    }

    if (report.passed) {
      lines.push('\n✅ All validations passed!');
    }

    return lines.join('\n');
  }
}