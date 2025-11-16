// src/utils/__tests__/errors.test.ts
import {
  APIxCustomError,
  ErrorCodes,
  createError,
  validateAccountId,
  validateNetwork,
  validateTokenSymbol,
  validateTokenName
} from '../errors';

describe('APIxCustomError', () => {
  it('should create error with all properties', () => {
    const error = new APIxCustomError(
      'Test error',
      'TEST_CODE',
      { detail: 'value' },
      ['suggestion 1', 'suggestion 2']
    );

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ detail: 'value' });
    expect(error.suggestions).toEqual(['suggestion 1', 'suggestion 2']);
    expect(error.name).toBe('APIxError');
  });

  it('should have proper stack trace', () => {
    const error = new APIxCustomError('Test', 'TEST');
    expect(error.stack).toBeDefined();
  });
});

describe('Error Factory Functions', () => {
  describe('createError.projectNotFound', () => {
    it('should create project not found error', () => {
      const error = createError.projectNotFound('/path/to/project');

      expect(error.message).toContain('/path/to/project');
      expect(error.code).toBe(ErrorCodes.PROJECT_NOT_FOUND);
      expect(error.details).toEqual({ path: '/path/to/project' });
      expect(error.suggestions).toBeDefined();
      expect(error.suggestions!.length).toBeGreaterThan(0);
    });
  });

  describe('createError.unsupportedFramework', () => {
    it('should create unsupported framework error', () => {
      const error = createError.unsupportedFramework('Svelte');

      expect(error.message).toContain('Svelte');
      expect(error.code).toBe(ErrorCodes.UNSUPPORTED_FRAMEWORK);
      expect(error.suggestions).toBeDefined();
    });
  });

  describe('createError.integrationExists', () => {
    it('should create integration exists error', () => {
      const error = createError.integrationExists('hts');

      expect(error.message).toContain('hts');
      expect(error.code).toBe(ErrorCodes.INTEGRATION_EXISTS);
      expect(error.suggestions![0]).toContain('--force');
    });
  });

  describe('createError.invalidAccountId', () => {
    it('should create invalid account ID error', () => {
      const error = createError.invalidAccountId('invalid-id');

      expect(error.message).toContain('invalid-id');
      expect(error.code).toBe(ErrorCodes.ACCOUNT_ID_INVALID);
      expect(error.suggestions![0]).toContain('0.0.123');
    });
  });

  describe('createError.templateNotFound', () => {
    it('should create template not found error', () => {
      const error = createError.templateNotFound('custom-template');

      expect(error.code).toBe(ErrorCodes.TEMPLATE_NOT_FOUND);
      expect(error.details.templateId).toBe('custom-template');
    });
  });

  describe('createError.configInvalid', () => {
    it('should create config invalid error', () => {
      const details = { field: 'network', value: 'invalid' };
      const error = createError.configInvalid(details);

      expect(error.code).toBe(ErrorCodes.CONFIG_INVALID);
      expect(error.details).toEqual(details);
    });
  });

  describe('createError.fileWriteError', () => {
    it('should create file write error', () => {
      const error = createError.fileWriteError('/path/file.ts', 'Permission denied');

      expect(error.message).toContain('/path/file.ts');
      expect(error.code).toBe(ErrorCodes.FILE_WRITE_ERROR);
      expect(error.details.reason).toBe('Permission denied');
    });
  });

  describe('createError.hederaConnectionFailed', () => {
    it('should create hedera connection failed error', () => {
      const error = createError.hederaConnectionFailed('testnet', 'Timeout');

      expect(error.message).toContain('testnet');
      expect(error.code).toBe(ErrorCodes.HEDERA_CONNECTION_FAILED);
      expect(error.details.reason).toBe('Timeout');
    });
  });
});

describe('Validation Functions', () => {
  describe('validateAccountId', () => {
    it('should validate correct account IDs', () => {
      expect(validateAccountId('0.0.123')).toBe(true);
      expect(validateAccountId('0.0.4912345')).toBe(true);
      expect(validateAccountId('1.2.3')).toBe(true);
    });

    it('should reject invalid account IDs', () => {
      expect(validateAccountId('0.0')).toBe(false);
      expect(validateAccountId('123')).toBe(false);
      expect(validateAccountId('0.0.abc')).toBe(false);
      expect(validateAccountId('invalid')).toBe(false);
      expect(validateAccountId('')).toBe(false);
    });
  });

  describe('validateNetwork', () => {
    it('should validate correct networks', () => {
      expect(validateNetwork('testnet')).toBe(true);
      expect(validateNetwork('mainnet')).toBe(true);
    });

    it('should reject invalid networks', () => {
      expect(validateNetwork('devnet')).toBe(false);
      expect(validateNetwork('TESTNET')).toBe(false);
      expect(validateNetwork('')).toBe(false);
      expect(validateNetwork('preview')).toBe(false);
    });
  });

  describe('validateTokenSymbol', () => {
    it('should validate correct token symbols', () => {
      expect(validateTokenSymbol('APIX')).toBe(true);
      expect(validateTokenSymbol('TEST')).toBe(true);
      expect(validateTokenSymbol('BTC')).toBe(true);
      expect(validateTokenSymbol('USDC')).toBe(true);
      expect(validateTokenSymbol('ABCDEF')).toBe(true);
    });

    it('should reject invalid token symbols', () => {
      expect(validateTokenSymbol('a')).toBe(false); // too short
      expect(validateTokenSymbol('TOOLONG')).toBe(false); // too long
      expect(validateTokenSymbol('test')).toBe(false); // lowercase
      expect(validateTokenSymbol('T3ST')).toBe(false); // numbers
      expect(validateTokenSymbol('TE-ST')).toBe(false); // special chars
      expect(validateTokenSymbol('')).toBe(false);
    });
  });

  describe('validateTokenName', () => {
    it('should validate correct token names', () => {
      expect(validateTokenName('APIX Token')).toBe(true);
      expect(validateTokenName('Test')).toBe(true);
      expect(validateTokenName('A'.repeat(50))).toBe(true);
      expect(validateTokenName('My Token 123')).toBe(true);
    });

    it('should reject invalid token names', () => {
      expect(validateTokenName('A')).toBe(false); // too short
      expect(validateTokenName('A'.repeat(51))).toBe(false); // too long
      expect(validateTokenName('')).toBe(false);
    });
  });
});
