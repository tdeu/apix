// src/utils/errors.ts

import { APIxError } from '@/types';

export class APIxCustomError extends Error implements APIxError {
  public code: string;
  public details?: any;
  public suggestions?: string[];

  constructor(
    message: string, 
    code: string, 
    details?: any, 
    suggestions?: string[]
  ) {
    super(message);
    this.name = 'APIxError';
    this.code = code;
    this.details = details;
    this.suggestions = suggestions;
    
    // Maintain proper stack trace for where error was thrown (Node.js only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIxCustomError);
    }
  }
}

// Predefined error types
export const ErrorCodes = {
  // Project Analysis Errors
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  INVALID_PROJECT_STRUCTURE: 'INVALID_PROJECT_STRUCTURE',
  UNSUPPORTED_FRAMEWORK: 'UNSUPPORTED_FRAMEWORK',
  PACKAGE_JSON_MISSING: 'PACKAGE_JSON_MISSING',
  
  // Integration Errors
  INTEGRATION_EXISTS: 'INTEGRATION_EXISTS',
  INVALID_INTEGRATION_TYPE: 'INVALID_INTEGRATION_TYPE',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  DEPENDENCY_CONFLICT: 'DEPENDENCY_CONFLICT',
  
  // Configuration Errors
  CONFIG_INVALID: 'CONFIG_INVALID',
  HEDERA_CONFIG_MISSING: 'HEDERA_CONFIG_MISSING',
  ACCOUNT_ID_INVALID: 'ACCOUNT_ID_INVALID',
  
  // File Operation Errors
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  
  // Network Errors
  HEDERA_CONNECTION_FAILED: 'HEDERA_CONNECTION_FAILED',
  MIRROR_NODE_ERROR: 'MIRROR_NODE_ERROR',
  
  // Template Errors
  TEMPLATE_RENDER_ERROR: 'TEMPLATE_RENDER_ERROR',
  VARIABLE_MISSING: 'VARIABLE_MISSING'
} as const;

// Error factory functions
export const createError = {
  projectNotFound: (path: string): APIxCustomError => 
    new APIxCustomError(
      `Project directory not found: ${path}`,
      ErrorCodes.PROJECT_NOT_FOUND,
      { path },
      [
        'Check if the path is correct',
        'Make sure you are in the right directory',
        'Use absolute path if needed'
      ]
    ),

  unsupportedFramework: (framework: string): APIxCustomError =>
    new APIxCustomError(
      `Unsupported framework: ${framework}`,
      ErrorCodes.UNSUPPORTED_FRAMEWORK,
      { framework },
      [
        'Supported frameworks: Next.js, React, Vue, Angular, Express',
        'Check if your package.json has the correct dependencies',
        'You can still use APIx with manual configuration'
      ]
    ),

  integrationExists: (type: string): APIxCustomError =>
    new APIxCustomError(
      `${type} integration already exists`,
      ErrorCodes.INTEGRATION_EXISTS,
      { type },
      [
        `Use --force flag to overwrite existing ${type} integration`,
        'Check existing integration status with `apix status`',
        'Remove existing integration first if needed'
      ]
    ),

  invalidAccountId: (accountId: string): APIxCustomError =>
    new APIxCustomError(
      `Invalid Hedera account ID format: ${accountId}`,
      ErrorCodes.ACCOUNT_ID_INVALID,
      { accountId },
      [
        'Account ID must be in format "0.0.123"',
        'Get your account ID from Hedera Portal',
        'Use testnet account ID for development'
      ]
    ),

  templateNotFound: (templateId: string): APIxCustomError =>
    new APIxCustomError(
      `Template not found: ${templateId}`,
      ErrorCodes.TEMPLATE_NOT_FOUND,
      { templateId },
      [
        'Check if the template ID is correct',
        'Update APIx to get latest templates',
        'Create a custom template if needed'
      ]
    ),

  configInvalid: (details: any): APIxCustomError =>
    new APIxCustomError(
      'Configuration file is invalid',
      ErrorCodes.CONFIG_INVALID,
      details,
      [
        'Run `apix init --force` to reset configuration',
        'Check configuration syntax',
        'Remove .apix directory to start fresh'
      ]
    ),

  fileWriteError: (path: string, reason?: string): APIxCustomError =>
    new APIxCustomError(
      `Failed to write file: ${path}`,
      ErrorCodes.FILE_WRITE_ERROR,
      { path, reason },
      [
        'Check file permissions',
        'Make sure directory exists',
        'Close file if it\'s open in another program'
      ]
    ),

  hederaConnectionFailed: (network: string, reason?: string): APIxCustomError =>
    new APIxCustomError(
      `Failed to connect to Hedera ${network}`,
      ErrorCodes.HEDERA_CONNECTION_FAILED,
      { network, reason },
      [
        'Check your internet connection',
        'Verify network configuration',
        'Try switching to testnet for development'
      ]
    )
};

// Error handler utility
export const handleError = (error: unknown, context?: string): never => {
  if (error instanceof APIxCustomError) {
    // Already formatted APIx error, just re-throw
    throw error;
  }
  
  if (error instanceof Error) {
    // Convert generic error to APIx error
    throw new APIxCustomError(
      `${context ? context + ': ' : ''}${error.message}`,
      'UNKNOWN_ERROR',
      { originalError: error.message },
      ['Check the error details above', 'Report this issue if it persists']
    );
  }
  
  // Unknown error type
  throw new APIxCustomError(
    `Unknown error${context ? ' in ' + context : ''}`,
    'UNKNOWN_ERROR',
    { error },
    ['This is an unexpected error', 'Please report this issue']
  );
};

// Validation utilities
export const validateAccountId = (accountId: string): boolean => {
  return /^\d+\.\d+\.\d+$/.test(accountId);
};

export const validateNetwork = (network: string): network is 'testnet' | 'mainnet' => {
  return network === 'testnet' || network === 'mainnet';
};

export const validateTokenSymbol = (symbol: string): boolean => {
  return /^[A-Z]{2,6}$/.test(symbol);
};

export const validateTokenName = (name: string): boolean => {
  return name.length >= 2 && name.length <= 50;
};