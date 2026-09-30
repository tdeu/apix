// src/utils/input-sanitizer.ts
import { validateAccountId, validateTokenSymbol, validateTokenName, createError } from './errors';

export interface TokenInputValidation {
  valid: boolean;
  errors: string[];
  sanitized?: {
    name: string;
    symbol: string;
    decimals: number;
    initialSupply: number;
  };
}

/**
 * Input sanitization and validation for blockchain operations
 */
export class InputSanitizer {
  /**
   * Sanitize and validate token creation parameters
   */
  static validateTokenCreation(params: {
    name: string;
    symbol: string;
    decimals?: number;
    initialSupply?: number;
  }): TokenInputValidation {
    const errors: string[] = [];

    // Sanitize inputs
    const name = params.name?.trim() || '';
    const symbol = params.symbol?.trim().toUpperCase() || '';
    const decimals = params.decimals ?? 8;
    const initialSupply = params.initialSupply ?? 1000000;

    // Validate token name
    if (!validateTokenName(name)) {
      if (name.length === 0) {
        errors.push('Token name is required');
      } else if (name.length < 2) {
        errors.push('Token name must be at least 2 characters');
      } else if (name.length > 50) {
        errors.push('Token name must be at most 50 characters');
      }
    }

    // Validate token symbol
    if (!validateTokenSymbol(symbol)) {
      if (symbol.length === 0) {
        errors.push('Token symbol is required');
      } else if (symbol.length < 2) {
        errors.push('Token symbol must be at least 2 characters');
      } else if (symbol.length > 6) {
        errors.push('Token symbol must be at most 6 characters');
      } else if (!/^[A-Z]+$/.test(symbol)) {
        errors.push('Token symbol must contain only uppercase letters (A-Z)');
      }
    }

    // Validate decimals (reject rather than silently fix NaN, fractions, negatives)
    if (!Number.isInteger(decimals)) {
      errors.push('Token decimals must be a whole number');
    } else if (decimals < 0) {
      errors.push('Token decimals must be non-negative');
    } else if (decimals > 18) {
      errors.push('Token decimals must be at most 18 (Hedera limitation)');
    }

    // Validate initial supply
    if (!Number.isInteger(initialSupply)) {
      errors.push('Initial supply must be a whole number');
    } else if (initialSupply < 0) {
      errors.push('Initial supply must be non-negative');
    } else if (initialSupply > Number.MAX_SAFE_INTEGER) {
      errors.push('Initial supply exceeds maximum safe integer');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: errors.length === 0 ? {
        name,
        symbol,
        decimals,
        initialSupply
      } : undefined
    };
  }

  /**
   * Validate account ID format
   */
  static validateAccountIdFormat(accountId: string): { valid: boolean; error?: string } {
    if (!accountId || typeof accountId !== 'string') {
      return { valid: false, error: 'Account ID is required and must be a string' };
    }

    const trimmed = accountId.trim();

    if (!validateAccountId(trimmed)) {
      return {
        valid: false,
        error: `Invalid account ID format: "${trimmed}". Expected format: 0.0.123`
      };
    }

    return { valid: true };
  }

  /**
   * Validate token ID format (similar to account ID)
   */
  static validateTokenIdFormat(tokenId: string): { valid: boolean; error?: string } {
    if (!tokenId || typeof tokenId !== 'string') {
      return { valid: false, error: 'Token ID is required and must be a string' };
    }

    const trimmed = tokenId.trim();

    // Token ID has same format as account ID (0.0.XXX)
    if (!validateAccountId(trimmed)) {
      return {
        valid: false,
        error: `Invalid token ID format: "${trimmed}". Expected format: 0.0.123456`
      };
    }

    return { valid: true };
  }

  /**
   * Validate any Hedera entity ID (contract, topic, ...) in 0.0.123 format
   */
  static validateEntityIdFormat(id: string, label: string): { valid: boolean; error?: string } {
    if (!id || typeof id !== 'string') {
      return { valid: false, error: `${label} is required and must be a string` };
    }

    const trimmed = id.trim();
    if (!validateAccountId(trimmed)) {
      return { valid: false, error: `Invalid ${label} format: "${trimmed}". Expected format: 0.0.123` };
    }

    return { valid: true };
  }

  /**
   * Validate an optional amount that may be zero (e.g. tinybars sent with a call)
   */
  static validateOptionalAmount(amount: number | undefined, label: string): { valid: boolean; error?: string } {
    if (amount === undefined) {
      return { valid: true };
    }
    if (!Number.isSafeInteger(amount) || amount < 0) {
      return { valid: false, error: `${label} must be a non-negative whole number` };
    }
    return { valid: true };
  }

  /**
   * Validate transfer amount
   */
  static validateTransferAmount(amount: number): { valid: boolean; error?: string } {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return { valid: false, error: 'Amount must be a valid number' };
    }

    if (amount <= 0) {
      return { valid: false, error: 'Amount must be greater than 0' };
    }

    if (!Number.isInteger(amount)) {
      return { valid: false, error: 'Amount must be an integer (no decimals)' };
    }

    if (amount > Number.MAX_SAFE_INTEGER) {
      return { valid: false, error: 'Amount exceeds maximum safe integer' };
    }

    return { valid: true };
  }

  /**
   * Sanitize string input to prevent injection attacks
   */
  static sanitizeString(input: string, maxLength: number = 1000): string {
    if (!input) return '';

    // Remove control characters and trim
    let sanitized = input
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .trim();

    // Truncate to max length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  /**
   * Validate contract bytecode
   */
  static validateBytecode(bytecode: string): { valid: boolean; error?: string } {
    if (!bytecode || typeof bytecode !== 'string') {
      return { valid: false, error: 'Bytecode is required and must be a string' };
    }

    const trimmed = bytecode.trim();

    // Check if it's hex format
    if (!trimmed.startsWith('0x')) {
      return {
        valid: false,
        error: 'Bytecode must start with "0x" prefix'
      };
    }

    // Remove 0x prefix and check if valid hex
    const hex = trimmed.substring(2);
    if (!/^[0-9a-fA-F]*$/.test(hex)) {
      return {
        valid: false,
        error: 'Bytecode must be valid hexadecimal'
      };
    }

    if (hex.length === 0) {
      return {
        valid: false,
        error: 'Bytecode cannot be empty'
      };
    }

    if (hex.length % 2 !== 0) {
      return {
        valid: false,
        error: 'Bytecode must have even number of hex characters'
      };
    }

    return { valid: true };
  }

  /**
   * Validate gas limit
   */
  static validateGasLimit(gas: number): { valid: boolean; error?: string } {
    if (typeof gas !== 'number' || isNaN(gas)) {
      return { valid: false, error: 'Gas must be a valid number' };
    }

    if (gas <= 0) {
      return { valid: false, error: 'Gas must be greater than 0' };
    }

    if (!Number.isInteger(gas)) {
      return { valid: false, error: 'Gas must be an integer' };
    }

    if (gas > 15000000) {
      return {
        valid: false,
        error: 'Gas limit exceeds maximum (15,000,000)'
      };
    }

    return { valid: true };
  }

  /**
   * Validate topic message
   */
  static validateTopicMessage(message: string): { valid: boolean; error?: string } {
    if (!message || typeof message !== 'string') {
      return { valid: false, error: 'Message is required and must be a string' };
    }

    // HCS message limit is 1024 bytes
    const byteLength = Buffer.from(message, 'utf-8').length;
    if (byteLength > 1024) {
      return {
        valid: false,
        error: `Message exceeds 1024 bytes limit (current: ${byteLength} bytes)`
      };
    }

    if (byteLength === 0) {
      return { valid: false, error: 'Message cannot be empty' };
    }

    return { valid: true };
  }

  /**
   * Comprehensive validation for all inputs
   */
  static validateAll(inputs: Record<string, any>, rules: Record<string, string>): {
    valid: boolean;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};

    for (const [field, rule] of Object.entries(rules)) {
      const value = inputs[field];

      switch (rule) {
        case 'accountId':
          const accountResult = this.validateAccountIdFormat(value);
          if (!accountResult.valid) {
            errors[field] = accountResult.error!;
          }
          break;

        case 'tokenId':
          const tokenResult = this.validateTokenIdFormat(value);
          if (!tokenResult.valid) {
            errors[field] = tokenResult.error!;
          }
          break;

        case 'amount':
          const amountResult = this.validateTransferAmount(value);
          if (!amountResult.valid) {
            errors[field] = amountResult.error!;
          }
          break;

        case 'gas':
          const gasResult = this.validateGasLimit(value);
          if (!gasResult.valid) {
            errors[field] = gasResult.error!;
          }
          break;

        case 'bytecode':
          const bytecodeResult = this.validateBytecode(value);
          if (!bytecodeResult.valid) {
            errors[field] = bytecodeResult.error!;
          }
          break;

        case 'topicMessage':
          const messageResult = this.validateTopicMessage(value);
          if (!messageResult.valid) {
            errors[field] = messageResult.error!;
          }
          break;

        default:
          // Unknown rule - skip
          break;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }
}
