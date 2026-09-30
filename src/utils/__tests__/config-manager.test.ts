// src/utils/__tests__/config-manager.test.ts
import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigurationManager } from '../config-manager';
import { APIxConfig, HederaConfiguration } from '../../types';

// Mock fs-extra
jest.mock('fs-extra');

// fs-extra's overloaded signatures make jest.Mocked<typeof fs> resolve to `never`,
// so type the functions ConfigurationManager uses as plain mocks.
const mockedFs = fs as unknown as Record<
  'access' | 'readJson' | 'ensureDir' | 'writeJson' | 'remove',
  jest.Mock
>;

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  const testConfigPath = '.apix/config.json';

  beforeEach(() => {
    configManager = new ConfigurationManager(testConfigPath);
    jest.clearAllMocks();
  });

  describe('exists', () => {
    it('should return true when config file exists', async () => {
      mockedFs.access.mockResolvedValue(undefined);

      const result = await configManager.exists();

      expect(result).toBe(true);
      expect(mockedFs.access).toHaveBeenCalledWith(testConfigPath);
    });

    it('should return false when config file does not exist', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await configManager.exists();

      expect(result).toBe(false);
    });
  });

  describe('load', () => {
    it('should load existing config file', async () => {
      const mockConfig: APIxConfig = {
        version: '1.0.0',
        hedera: {
          network: 'testnet',
          accountId: '0.0.123',
          privateKey: 'test-key',
          mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
        },
        integrations: {
          hts: true,
          'smart-contract': false,
          wallet: true,
          consensus: false,
          account: true
        },
        preferences: {
          framework: 'next.js',
          language: 'typescript',
          packageManager: 'npm',
          codeStyle: 'prettier'
        },
        templates: {
          customPaths: {},
          overrides: {}
        }
      };

      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readJson.mockResolvedValue(mockConfig);

      const result = await configManager.load();

      expect(result).toEqual(mockConfig);
      expect(mockedFs.readJson).toHaveBeenCalledWith(testConfigPath);
    });

    it('should return default config when file does not exist', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await configManager.load();

      expect(result.version).toBe('1.0.0');
      expect(result.hedera.network).toBe('testnet');
      expect(result.integrations.hts).toBe(false);
    });

    it('should return default config when file is invalid', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readJson.mockRejectedValue(new Error('Invalid JSON'));

      const result = await configManager.load();

      expect(result.version).toBe('1.0.0');
    });
  });

  describe('save', () => {
    it('should save config to file', async () => {
      const mockExistingConfig: APIxConfig = {
        version: '1.0.0',
        hedera: {
          network: 'testnet',
          mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
        },
        integrations: {
          hts: false,
          'smart-contract': false,
          wallet: false,
          consensus: false,
          account: false
        },
        preferences: {
          framework: 'next.js',
          language: 'typescript',
          packageManager: 'npm',
          codeStyle: 'prettier'
        },
        templates: {
          customPaths: {},
          overrides: {}
        }
      };

      mockedFs.access.mockRejectedValue(new Error('ENOENT')); // File doesn't exist
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.writeJson.mockResolvedValue(undefined);

      // save() merges top-level keys only, so hedera must be a complete HederaConfiguration
      const updates: Partial<APIxConfig> = {
        hedera: {
          network: 'testnet',
          accountId: '0.0.456',
          mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
        }
      };
      await configManager.save(updates);

      expect(mockedFs.ensureDir).toHaveBeenCalledWith(path.dirname(testConfigPath));
      expect(mockedFs.writeJson).toHaveBeenCalledWith(
        testConfigPath,
        expect.objectContaining({
          hedera: expect.objectContaining({
            accountId: '0.0.456'
          })
        }),
        { spaces: 2 }
      );
    });

    it('should throw error when save fails', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.writeJson.mockRejectedValue(new Error('Permission denied'));

      await expect(configManager.save({})).rejects.toThrow();
    });
  });

  describe('validateHederaConfig', () => {
    it('should validate correct hedera config', async () => {
      const validConfig: APIxConfig = {
        version: '1.0.0',
        hedera: {
          network: 'testnet',
          accountId: '0.0.123',
          mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
        },
        integrations: { hts: false, 'smart-contract': false, wallet: false, consensus: false, account: false },
        preferences: { framework: 'next.js', language: 'typescript', packageManager: 'npm', codeStyle: 'prettier' },
        templates: { customPaths: {}, overrides: {} }
      };

      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readJson.mockResolvedValue(validConfig);

      await configManager.load();
      const result = await configManager.validateHederaConfig();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid network', async () => {
      const invalidConfig: APIxConfig = {
        version: '1.0.0',
        hedera: {
          network: 'devnet' as any,
          mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
        },
        integrations: { hts: false, 'smart-contract': false, wallet: false, consensus: false, account: false },
        preferences: { framework: 'next.js', language: 'typescript', packageManager: 'npm', codeStyle: 'prettier' },
        templates: { customPaths: {}, overrides: {} }
      };

      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readJson.mockResolvedValue(invalidConfig);

      await configManager.load();
      const result = await configManager.validateHederaConfig();

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid network');
    });

    it('should reject invalid account ID format', async () => {
      const invalidConfig: APIxConfig = {
        version: '1.0.0',
        hedera: {
          network: 'testnet',
          accountId: 'invalid-id',
          mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
        },
        integrations: { hts: false, 'smart-contract': false, wallet: false, consensus: false, account: false },
        preferences: { framework: 'next.js', language: 'typescript', packageManager: 'npm', codeStyle: 'prettier' },
        templates: { customPaths: {}, overrides: {} }
      };

      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readJson.mockResolvedValue(invalidConfig);

      await configManager.load();
      const result = await configManager.validateHederaConfig();

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid account ID format');
    });

    it('should reject non-HTTPS mirror node URL', async () => {
      const invalidConfig: APIxConfig = {
        version: '1.0.0',
        hedera: {
          network: 'testnet',
          mirrorNodeUrl: 'http://testnet.mirrornode.hedera.com'
        },
        integrations: { hts: false, 'smart-contract': false, wallet: false, consensus: false, account: false },
        preferences: { framework: 'next.js', language: 'typescript', packageManager: 'npm', codeStyle: 'prettier' },
        templates: { customPaths: {}, overrides: {} }
      };

      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readJson.mockResolvedValue(invalidConfig);

      await configManager.load();
      const result = await configManager.validateHederaConfig();

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must use HTTPS');
    });
  });

  describe('updateIntegration', () => {
    it('should update integration status', async () => {
      const mockConfig: APIxConfig = {
        version: '1.0.0',
        hedera: {
          network: 'testnet',
          mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
        },
        integrations: {
          hts: false,
          'smart-contract': false,
          wallet: false,
          consensus: false,
          account: false
        },
        preferences: {
          framework: 'next.js',
          language: 'typescript',
          packageManager: 'npm',
          codeStyle: 'prettier'
        },
        templates: {
          customPaths: {},
          overrides: {}
        }
      };

      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readJson.mockResolvedValue(mockConfig);
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.writeJson.mockResolvedValue(undefined);

      await configManager.updateIntegration('hts', true);

      expect(mockedFs.writeJson).toHaveBeenCalledWith(
        testConfigPath,
        expect.objectContaining({
          integrations: expect.objectContaining({
            hts: true
          })
        }),
        { spaces: 2 }
      );
    });
  });

  describe('reset', () => {
    it('should remove config file when it exists', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.remove.mockResolvedValue(undefined);

      await configManager.reset();

      expect(mockedFs.remove).toHaveBeenCalledWith(testConfigPath);
    });

    it('should not fail when config file does not exist', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(configManager.reset()).resolves.not.toThrow();
    });
  });

  describe('exportConfig', () => {
    it('should export config as JSON string', async () => {
      const mockConfig: APIxConfig = {
        version: '1.0.0',
        hedera: {
          network: 'testnet',
          mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
        },
        integrations: { hts: false, 'smart-contract': false, wallet: false, consensus: false, account: false },
        preferences: { framework: 'next.js', language: 'typescript', packageManager: 'npm', codeStyle: 'prettier' },
        templates: { customPaths: {}, overrides: {} }
      };

      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readJson.mockResolvedValue(mockConfig);

      const exported = await configManager.exportConfig();
      const parsed = JSON.parse(exported);

      expect(parsed).toEqual(mockConfig);
    });
  });

  describe('importConfig', () => {
    it('should import valid config JSON', async () => {
      const configJson = JSON.stringify({
        version: '1.0.0',
        hedera: {
          network: 'testnet',
          mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
        },
        integrations: { hts: true },
        preferences: {},
        templates: {}
      });

      mockedFs.access.mockRejectedValue(new Error('ENOENT'));
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.writeJson.mockResolvedValue(undefined);

      await expect(configManager.importConfig(configJson)).resolves.not.toThrow();
    });

    it('should reject invalid JSON', async () => {
      const invalidJson = 'not valid json';

      await expect(configManager.importConfig(invalidJson)).rejects.toThrow('Invalid configuration format');
    });
  });
});
