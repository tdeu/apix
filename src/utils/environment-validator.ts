// src/utils/environment-validator.ts
import chalk from 'chalk';
import { logger } from './logger';
import { validateAccountId, validateNetwork } from './errors';

export interface EnvironmentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  mode: 'production' | 'partial';
}

export interface EnvironmentRequirements {
  requireHedera?: boolean;
  requireAI?: boolean;
  requireOpenAI?: boolean;
  requireAnthropic?: boolean;
  operation?: string; // For better error messages
}

/**
 * Comprehensive environment validation for APIX operations
 */
export class EnvironmentValidator {
  /**
   * Validate environment before operations
   */
  static validate(requirements: EnvironmentRequirements = {}): EnvironmentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let mode: 'production' | 'partial' = 'production';

    // Check Hedera credentials
    const hederaValidation = this.validateHederaCredentials();
    if (requirements.requireHedera && !hederaValidation.valid) {
      errors.push(...hederaValidation.errors);
      errors.push('Hedera credentials required for blockchain operations');
      errors.push('Get testnet credentials from: https://portal.hedera.com/faucet');
    } else if (!hederaValidation.valid) {
      warnings.push(...hederaValidation.warnings);
      mode = 'partial';
    }

    // Check AI credentials
    if (requirements.requireAI || requirements.requireOpenAI) {
      const aiValidation = this.validateAICredentials(requirements);
      if (!aiValidation.valid) {
        if (requirements.requireAI || requirements.requireOpenAI) {
          errors.push(...aiValidation.errors);
        } else {
          warnings.push(...aiValidation.warnings);
        }
        if (mode === 'production') {
          mode = 'partial';
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      mode
    };
  }

  /**
   * Validate Hedera blockchain credentials
   */
  private static validateHederaCredentials(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const accountId = process.env.HEDERA_ACCOUNT_ID;
    const privateKey = process.env.HEDERA_PRIVATE_KEY;
    const network = process.env.HEDERA_NETWORK || 'testnet';

    // Check if credentials exist
    if (!accountId || !privateKey) {
      warnings.push('Hedera credentials not found - blockchain operations will fail');
      warnings.push('Set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in .env file');
      return { valid: false, errors, warnings };
    }

    // Validate account ID format
    if (!validateAccountId(accountId)) {
      errors.push(`Invalid HEDERA_ACCOUNT_ID format: "${accountId}"`);
      errors.push('Expected format: 0.0.123');
    }

    // Validate private key format (basic check)
    if (privateKey.length < 64) {
      errors.push('HEDERA_PRIVATE_KEY appears to be invalid (too short)');
      errors.push('Expected: DER-encoded private key or hex string');
    }

    // Validate network
    if (!validateNetwork(network)) {
      errors.push(`Invalid HEDERA_NETWORK: "${network}"`);
      errors.push('Expected: "testnet" or "mainnet"');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate AI service credentials
   */
  private static validateAICredentials(requirements: EnvironmentRequirements): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    const hasAnyAI = openaiKey || anthropicKey || groqKey;

    if (requirements.requireOpenAI && !openaiKey) {
      errors.push('OPENAI_API_KEY is required for this operation');
      errors.push('Get your API key from: https://platform.openai.com/api-keys');
      return { valid: false, errors, warnings };
    }

    if (requirements.requireAnthropic && !anthropicKey) {
      errors.push('ANTHROPIC_API_KEY is required for this operation');
      errors.push('Get your API key from: https://console.anthropic.com/');
      return { valid: false, errors, warnings };
    }

    if (requirements.requireAI && !hasAnyAI) {
      errors.push('At least one AI API key is required (OpenAI, Anthropic, or Groq)');
      errors.push('Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY in your .env file');
      return { valid: false, errors, warnings };
    }

    // Validate key formats
    if (openaiKey && !openaiKey.startsWith('sk-')) {
      warnings.push('OPENAI_API_KEY format appears invalid (should start with "sk-")');
    }

    if (anthropicKey && !anthropicKey.startsWith('sk-ant-')) {
      warnings.push('ANTHROPIC_API_KEY format appears invalid (should start with "sk-ant-")');
    }

    return {
      valid: true,
      errors,
      warnings
    };
  }

  /**
   * Display validation results to user
   */
  static displayResults(
    result: EnvironmentValidationResult,
    operation?: string
  ): void {
    if (result.valid && result.warnings.length === 0) {
      // Everything is perfect - silent success
      return;
    }

    console.log(); // Blank line for spacing

    // Show mode banner
    if (result.mode === 'partial') {
      console.log(chalk.cyan.bold('ℹ️  PARTIAL MODE'));
      console.log(chalk.cyan('Some features limited. Add credentials for full functionality.'));
      console.log();
    }

    // Show errors
    if (result.errors.length > 0) {
      console.log(chalk.red.bold('❌ Environment Errors:'));
      result.errors.forEach(error => {
        console.log(chalk.red(`   ${error}`));
      });
      console.log();
    }

    // Show warnings
    if (result.warnings.length > 0) {
      console.log(chalk.yellow.bold('⚠️  Warnings:'));
      result.warnings.forEach(warning => {
        console.log(chalk.yellow(`   ${warning}`));
      });
      console.log();
    }

    // Show helpful next steps
    if (!result.valid) {
      console.log(chalk.cyan.bold('📝 Next Steps:'));
      console.log(chalk.cyan('   1. Copy .env.example to .env'));
      console.log(chalk.cyan('   2. Add your credentials to .env'));
      console.log(chalk.cyan('   3. Run the command again'));
      console.log();
    }
  }

  /**
   * Validate and throw if invalid (for critical operations)
   */
  static validateOrThrow(requirements: EnvironmentRequirements): void {
    const result = this.validate(requirements);

    if (!result.valid) {
      this.displayResults(result, requirements.operation);
      throw new Error(
        `Environment validation failed for ${requirements.operation || 'operation'}. ` +
        `${result.errors.length} error(s) found.`
      );
    }

    // Show warnings even if valid
    if (result.warnings.length > 0) {
      this.displayResults(result, requirements.operation);
    }
  }

  /**
   * Get environment summary for debugging
   */
  static getSummary(): Record<string, string> {
    return {
      'HEDERA_ACCOUNT_ID': process.env.HEDERA_ACCOUNT_ID ? '✅ Set' : '❌ Missing',
      'HEDERA_PRIVATE_KEY': process.env.HEDERA_PRIVATE_KEY ? '✅ Set' : '❌ Missing',
      'HEDERA_NETWORK': process.env.HEDERA_NETWORK || 'testnet (default)',
      'OPENAI_API_KEY': process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
      'ANTHROPIC_API_KEY': process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Missing',
      'GROQ_API_KEY': process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing',
    };
  }

  /**
   * Print environment summary
   */
  static printSummary(): void {
    const summary = this.getSummary();

    console.log(chalk.cyan.bold('\n🔍 Environment Configuration:'));
    console.log();

    Object.entries(summary).forEach(([key, value]) => {
      const status = value.includes('✅') ? chalk.green(value) : chalk.red(value);
      console.log(`   ${chalk.gray(key.padEnd(20))} ${status}`);
    });

    console.log();
  }
}
