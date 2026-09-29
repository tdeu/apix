// src/services/__tests__/hedera-operations.test.ts
import { Client, PrivateKey } from '@hashgraph/sdk';
import { HederaOperationsService, TokenCreationOptions } from '../hedera-operations';

// Mock dependencies
jest.mock('../../utils/logger');

describe('HederaOperationsService', () => {
  let service: HederaOperationsService;

  beforeEach(() => {
    service = new HederaOperationsService('testnet');
    jest.restoreAllMocks();
    jest.clearAllMocks();
    delete process.env.HEDERA_ACCOUNT_ID;
    delete process.env.HEDERA_PRIVATE_KEY;
    delete process.env.HEDERA_NETWORK;
  });

  afterEach(() => {
    service.close();
  });

  describe('Initialization', () => {
    it('should throw a helpful error without credentials', async () => {
      const forTestnet = jest.spyOn(Client, 'forTestnet');

      await expect(service.initialize()).rejects.toThrow(/Hedera credentials are not configured/);
      await expect(service.initialize()).rejects.toThrow(/HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY/);
      await expect(service.initialize()).rejects.toThrow(/portal\.hedera\.com\/faucet/);
      expect(forTestnet).not.toHaveBeenCalled();
      expect(service.getCapabilities().directSDK).toBe(false);
    });

    it('should reject malformed credentials before creating a Client', async () => {
      process.env.HEDERA_ACCOUNT_ID = 'invalid';
      process.env.HEDERA_PRIVATE_KEY = 'invalid';
      const forTestnet = jest.spyOn(Client, 'forTestnet');

      await expect(service.initialize()).rejects.toThrow(/Invalid HEDERA_ACCOUNT_ID format/);
      expect(forTestnet).not.toHaveBeenCalled();
    });

    it('should close the Client when the operator key is rejected', async () => {
      process.env.HEDERA_ACCOUNT_ID = '0.0.1234';
      process.env.HEDERA_PRIVATE_KEY = 'z'.repeat(64); // passes the length check, not a key

      const realForTestnet = Client.forTestnet.bind(Client);
      let closeSpy: jest.SpyInstance | undefined;
      jest.spyOn(Client, 'forTestnet').mockImplementation(() => {
        const client = realForTestnet();
        closeSpy = jest.spyOn(client, 'close');
        return client;
      });

      await expect(service.initialize()).rejects.toThrow(/initialization failed/);
      expect(closeSpy).toHaveBeenCalledTimes(1);
      expect(service.getCapabilities().directSDK).toBe(false);
    });

    it('should configure the operator from valid credentials', async () => {
      process.env.HEDERA_ACCOUNT_ID = '0.0.1234';
      process.env.HEDERA_PRIVATE_KEY = PrivateKey.generateED25519().toStringDer();

      await service.initialize();

      expect(service.getCurrentAccountId()).toBe('0.0.1234');
      expect(service.getCapabilities()).toEqual({ directSDK: true });
    });
  });

  describe('Input Validation', () => {
    const validToken: TokenCreationOptions = { name: 'Test Token', symbol: 'TEST', decimals: 8, initialSupply: 1000000 };

    // Every case must throw before initialize(), i.e. before any SDK call
    const cases: Array<[string, (s: HederaOperationsService) => Promise<unknown>, RegExp]> = [
      ['empty token name', s => s.createToken({ ...validToken, name: '' }), /Token name is required/],
      ['invalid token symbol', s => s.createToken({ ...validToken, symbol: 'invalid-symbol' }), /Token symbol must be at most 6 characters/],
      ['negative decimals', s => s.createToken({ ...validToken, decimals: -1 }), /decimals must be non-negative/],
      ['NaN decimals', s => s.createToken({ ...validToken, decimals: NaN }), /decimals must be a whole number/],
      ['negative initial supply', s => s.createToken({ ...validToken, initialSupply: -5 }), /Initial supply must be non-negative/],
      ['invalid treasury account', s => s.createToken({ ...validToken, treasuryAccount: 'treasury' }), /Invalid account ID format/],
      ['invalid transfer account ID', s => s.transferToken({ tokenId: '0.0.123', fromAccount: 'invalid-account', toAccount: '0.0.456', amount: 100 }), /Invalid account ID format: "invalid-account"/],
      ['invalid transfer token ID', s => s.transferToken({ tokenId: 'token', fromAccount: '0.0.1', toAccount: '0.0.2', amount: 100 }), /Invalid token ID format/],
      ['zero transfer amount', s => s.transferToken({ tokenId: '0.0.123', fromAccount: '0.0.1', toAccount: '0.0.2', amount: 0 }), /Amount must be greater than 0/],
      ['fractional transfer amount', s => s.transferToken({ tokenId: '0.0.123', fromAccount: '0.0.1', toAccount: '0.0.2', amount: 1.5 }), /Amount must be an integer/],
      ['invalid contract ID', s => s.callSmartContract({ contractId: 'contract', functionName: 'f', gas: 50000 }), /Invalid contract ID format/],
      ['negative payable amount', s => s.callSmartContract({ contractId: '0.0.5', functionName: 'f', gas: 50000, payableAmount: -1 }), /Payable amount must be a non-negative whole number/],
      ['gas over the limit', s => s.deploySmartContract({ bytecode: '0x00', gas: 20_000_000 }), /Gas limit exceeds maximum/],
      ['invalid topic ID', s => s.submitTopicMessage({ topicId: 'topic', message: 'hi' }), /Invalid topic ID format/],
      ['empty topic message', s => s.submitTopicMessage({ topicId: '0.0.7', message: '' }), /Message is required/],
      ['oversized topic message', s => s.submitTopicMessage({ topicId: '0.0.7', message: 'x'.repeat(1025) }), /exceeds 1024 bytes/],
    ];

    it.each(cases)('should reject %s before any SDK call', async (_name, call, expected) => {
      const initialize = jest.spyOn(service, 'initialize');
      const forTestnet = jest.spyOn(Client, 'forTestnet');

      await expect(call(service)).rejects.toThrow(expected);
      expect(initialize).not.toHaveBeenCalled();
      expect(forTestnet).not.toHaveBeenCalled();
    });

    it('should reach credential checks once input is valid', async () => {
      await expect(service.createToken(validToken)).rejects.toThrow(/Hedera credentials are not configured/);
    });
  });

  describe('Service Status', () => {
    it('should report network correctly', () => {
      const testnetService = new HederaOperationsService('testnet');
      expect(testnetService.getNetwork()).toBe('testnet');

      const mainnetService = new HederaOperationsService('mainnet');
      expect(mainnetService.getNetwork()).toBe('mainnet');
    });

    it('should report no capabilities before initialization', () => {
      expect(service.getCapabilities()).toEqual({ directSDK: false });
      expect(service.getCurrentAccountId()).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should close client connections', async () => {
      process.env.HEDERA_ACCOUNT_ID = '0.0.1234';
      process.env.HEDERA_PRIVATE_KEY = PrivateKey.generateED25519().toStringDer();
      await service.initialize();
      expect(service.getCapabilities().directSDK).toBe(true);

      service.close();

      expect(service.getCapabilities().directSDK).toBe(false);
      expect(service.getCurrentAccountId()).toBeNull();
    });
  });
});
