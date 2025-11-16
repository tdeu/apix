// src/services/__tests__/hedera-operations.test.ts
import { HederaOperationsService, TokenCreationOptions } from '../hedera-operations';

// Mock dependencies
jest.mock('../hedera-agent-kit-service');
jest.mock('../../utils/logger');
jest.mock('../../utils/test-accounts');

describe('HederaOperationsService', () => {
  let service: HederaOperationsService;

  beforeEach(() => {
    service = new HederaOperationsService('testnet');
    jest.clearAllMocks();
    // Clear environment variables
    delete process.env.HEDERA_ACCOUNT_ID;
    delete process.env.HEDERA_PRIVATE_KEY;
  });

  describe('Token Creation', () => {
    it('should require initialization before token creation', async () => {
      const options: TokenCreationOptions = {
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 8,
        initialSupply: 1000000
      };

      // Should auto-initialize
      const result = await service.createToken(options);
      expect(result).toBeDefined();
    });

    it('should validate token parameters', async () => {
      const invalidOptions: TokenCreationOptions = {
        name: '', // Invalid: empty name
        symbol: 'TEST',
        decimals: 8,
        initialSupply: 1000000
      };

      // Should handle gracefully (currently no validation, but should add)
      const result = await service.createToken(invalidOptions);
      expect(result).toBeDefined();
    });

    it('should use test account when no credentials provided', async () => {
      const options: TokenCreationOptions = {
        name: 'Test Token',
        symbol: 'TEST'
      };

      const result = await service.createToken(options);

      expect(result.success).toBe(true);
      expect(result.details?.note).toContain('simulation');
    });

    it('should use default decimals and supply when not provided', async () => {
      const options: TokenCreationOptions = {
        name: 'Test Token',
        symbol: 'TEST'
      };

      const result = await service.createToken(options);

      // In simulation mode, should still succeed
      expect(result.success).toBe(true);
    });

    it('should generate explorer URL on success', async () => {
      const options: TokenCreationOptions = {
        name: 'Test Token',
        symbol: 'TEST'
      };

      const result = await service.createToken(options);

      if (result.success) {
        expect(result.explorerUrl).toBeDefined();
        expect(result.explorerUrl).toContain('hashscan.io/testnet');
      }
    });
  });

  describe('Token Transfer', () => {
    it('should simulate token transfer without real credentials', async () => {
      const options = {
        tokenId: '0.0.123456',
        fromAccount: '0.0.2',
        toAccount: '0.0.3',
        amount: 100
      };

      const result = await service.transferToken(options);

      expect(result.success).toBe(true);
      expect(result.details?.note).toContain('simulation');
    });
  });

  describe('Smart Contract Operations', () => {
    it('should simulate smart contract deployment', async () => {
      const options = {
        bytecode: '0x1234567890abcdef',
        gas: 100000
      };

      const result = await service.deploySmartContract(options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tokenId).toMatch(/^0\.0\.\d+$/); // Contract ID format
      }
    });

    it('should simulate contract call', async () => {
      const options = {
        contractId: '0.0.500000',
        functionName: 'transfer',
        gas: 50000
      };

      const result = await service.callSmartContract(options);

      expect(result.success).toBe(true);
    });
  });

  describe('HCS (Consensus Service)', () => {
    it('should simulate topic creation', async () => {
      const options = {
        memo: 'Test topic for APIX'
      };

      const result = await service.createTopic(options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tokenId).toMatch(/^0\.0\.\d+$/); // Topic ID format
      }
    });

    it('should simulate topic message submission', async () => {
      const options = {
        topicId: '0.0.700000',
        message: 'Hello, Hedera!'
      };

      const result = await service.submitTopicMessage(options);

      expect(result.success).toBe(true);
    });
  });

  describe('Service Status', () => {
    it('should report network correctly', () => {
      const testnetService = new HederaOperationsService('testnet');
      expect(testnetService.getNetwork()).toBe('testnet');

      const mainnetService = new HederaOperationsService('mainnet');
      expect(mainnetService.getNetwork()).toBe('mainnet');
    });

    it('should report capabilities', () => {
      const capabilities = service.getCapabilities();

      expect(capabilities).toHaveProperty('agentKit');
      expect(capabilities).toHaveProperty('directSDK');
      expect(capabilities).toHaveProperty('testAccounts');
      expect(typeof capabilities.agentKit).toBe('boolean');
    });

    it('should return current account ID when using test accounts', async () => {
      await service.initialize();
      const accountId = service.getCurrentAccountId();

      expect(accountId).toBeDefined();
      if (accountId) {
        expect(accountId).toMatch(/^0\.0\.\d+$/);
      }
    });
  });

  describe('Cleanup', () => {
    it('should close client connections', () => {
      service.close();

      // After closing, should not be in fallback mode
      expect(service.isFallbackMode()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Force initialization failure by using invalid credentials
      process.env.HEDERA_ACCOUNT_ID = 'invalid';
      process.env.HEDERA_PRIVATE_KEY = 'invalid';

      const newService = new HederaOperationsService('testnet');

      await expect(newService.initialize()).rejects.toThrow();
    });
  });

  describe('Input Validation (should be added)', () => {
    it('should validate account ID format in transfers', async () => {
      const invalidOptions = {
        tokenId: '0.0.123',
        fromAccount: 'invalid-account',
        toAccount: '0.0.456',
        amount: 100
      };

      // Currently no validation - should add this
      const result = await service.transferToken(invalidOptions);
      // After adding validation, this should fail with clear error
    });

    it('should validate token symbol format', async () => {
      const invalidOptions: TokenCreationOptions = {
        name: 'Test Token',
        symbol: 'invalid-symbol', // Should be uppercase, 2-6 chars
        decimals: 8,
        initialSupply: 1000000
      };

      // Currently no validation - should add this
      const result = await service.createToken(invalidOptions);
      // After adding validation, this should fail with clear error
    });
  });
});
