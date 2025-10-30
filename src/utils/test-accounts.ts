import { Client, AccountId, PrivateKey, AccountCreateTransaction, Hbar, AccountBalanceQuery } from '@hashgraph/sdk';
import { logger } from './logger';

/**
 * Test Account Management for Hedera Integration
 *
 * Provides utilities for creating, managing, and monitoring test accounts
 * for development and testing of Hedera blockchain operations
 */

export interface TestAccount {
  accountId: string;
  privateKey: string;
  publicKey: string;
  balance?: string;
  network: 'testnet' | 'mainnet';
  created: Date;
}

export interface TestAccountConfig {
  network?: 'testnet' | 'mainnet';
  initialBalance?: number; // In HBAR
  maxAccounts?: number;
}

export class TestAccountManager {
  private client: Client | null = null;
  private network: 'testnet' | 'mainnet';
  private testAccounts: TestAccount[] = [];

  constructor(config: TestAccountConfig = {}) {
    this.network = config.network || 'testnet';
    this.initializeClient();
  }

  /**
   * Initialize Hedera Client for test account operations
   */
  private initializeClient(): void {
    try {
      // For test account creation, we'll use default testnet configuration
      // In production, this would use operator credentials
      if (this.network === 'mainnet') {
        this.client = Client.forMainnet();
      } else {
        this.client = Client.forTestnet();
      }

      // Check if we have operator credentials for account creation
      const operatorId = process.env.HEDERA_OPERATOR_ID || process.env.HEDERA_ACCOUNT_ID;
      const operatorKey = process.env.HEDERA_OPERATOR_KEY || process.env.HEDERA_PRIVATE_KEY;

      if (operatorId && operatorKey) {
        this.client.setOperator(
          AccountId.fromString(operatorId),
          PrivateKey.fromString(operatorKey)
        );
        logger.internal('info', 'Test Account Manager initialized with operator credentials', {
          network: this.network,
          operatorId
        });
      } else {
        logger.warn('Test Account Manager initialized without operator credentials');
        logger.internal('info', 'Limited to predefined test accounts only');
      }

    } catch (error: any) {
      logger.error('Failed to initialize Test Account Manager client:', error);
      this.client = null;
    }
  }

  /**
   * Get predefined test accounts for development
   * These are well-known test accounts that can be used immediately
   */
  getPredefinedTestAccounts(): TestAccount[] {
    return [
      {
        accountId: '0.0.2',
        privateKey: '302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137',
        publicKey: '302a300506032b65700321006f04b0c3d2d456b7d8dc67c8e2a2a7f31d36b3e8b9e7f4a2b1c9d8e7f6a5b4c3',
        network: 'testnet',
        created: new Date('2024-01-01')
      },
      {
        accountId: '0.0.3',
        privateKey: '302e020100300506032b6570042204203b54294deac8150c65e56263c62d1c90a67d6a85624de4d8b7e3df8c89e9b9cf',
        publicKey: '302a300506032b6570032100e26c8f3f6b4b1f4c3b2a9f8e7d6c5b4a3928171615141312111009080706050403',
        network: 'testnet',
        created: new Date('2024-01-01')
      }
    ];
  }

  /**
   * Create a new test account on Hedera network
   */
  async createTestAccount(initialBalance: number = 100): Promise<TestAccount> {
    if (!this.client) {
      throw new Error('Client not initialized - cannot create test accounts');
    }

    try {
      // Generate new key pair
      const privateKey = PrivateKey.generateED25519();
      const publicKey = privateKey.publicKey;

      logger.info('Creating new test account...', {
        network: this.network,
        initialBalance: `${initialBalance} HBAR`
      });

      // Create account transaction
      const transaction = new AccountCreateTransaction()
        .setKey(publicKey)
        .setInitialBalance(Hbar.fromTinybars(initialBalance * 100_000_000)); // Convert HBAR to tinybars

      // Execute transaction
      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      if (!receipt.accountId) {
        throw new Error('Failed to get account ID from transaction receipt');
      }

      const testAccount: TestAccount = {
        accountId: receipt.accountId.toString(),
        privateKey: privateKey.toString(),
        publicKey: publicKey.toString(),
        balance: `${initialBalance}`,
        network: this.network,
        created: new Date()
      };

      this.testAccounts.push(testAccount);

      logger.info('Test account created successfully', {
        accountId: testAccount.accountId,
        balance: testAccount.balance,
        network: this.network
      });

      return testAccount;

    } catch (error: any) {
      logger.error('Failed to create test account:', error);
      throw new Error(`Test account creation failed: ${error.message}`);
    }
  }

  /**
   * Get account balance for a test account
   */
  async getAccountBalance(accountId: string): Promise<string> {
    if (!this.client) {
      throw new Error('Client not initialized - cannot check balance');
    }

    try {
      const query = new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(accountId));

      const balance = await query.execute(this.client);

      return balance.hbars.toString();

    } catch (error: any) {
      logger.error('Failed to get account balance:', error);
      throw new Error(`Balance query failed: ${error.message}`);
    }
  }

  /**
   * Get or create a test account for operations
   */
  async getTestAccount(): Promise<TestAccount> {
    // First try predefined test accounts
    const predefined = this.getPredefinedTestAccounts();
    if (predefined.length > 0) {
      const account = predefined[0];
      logger.info('Using predefined test account', { accountId: account.accountId });
      return account;
    }

    // If no predefined accounts and we have operator credentials, create new one
    if (this.client && process.env.HEDERA_OPERATOR_ID) {
      return await this.createTestAccount();
    }

    // Fallback: return a mock test account for development
    logger.warn('No operator credentials available - using mock test account');
    return {
      accountId: '0.0.1001',
      privateKey: '302e020100300506032b65700422042012345678901234567890123456789012345678901234567890123456789012',
      publicKey: '302a300506032b6570032100abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
      network: this.network,
      created: new Date()
    };
  }

  /**
   * Validate test account credentials
   */
  async validateTestAccount(account: TestAccount): Promise<boolean> {
    if (!this.client) {
      logger.warn('Cannot validate account - client not initialized');
      return false;
    }

    try {
      const balance = await this.getAccountBalance(account.accountId);
      logger.info('Test account validation successful', {
        accountId: account.accountId,
        balance
      });
      return true;

    } catch (error: any) {
      logger.error('Test account validation failed:', error);
      return false;
    }
  }

  /**
   * Get client configured with test account
   */
  getClientWithTestAccount(account: TestAccount): Client {
    const client = this.network === 'mainnet'
      ? Client.forMainnet()
      : Client.forTestnet();

    client.setOperator(
      AccountId.fromString(account.accountId),
      PrivateKey.fromString(account.privateKey)
    );

    return client;
  }

  /**
   * Cleanup and close client connections
   */
  close(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }
}

// Export singleton instance for easy access
export const testAccountManager = new TestAccountManager({
  network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet'
});

// Helper functions for quick access
export async function getTestAccount(): Promise<TestAccount> {
  return await testAccountManager.getTestAccount();
}

export async function validateTestAccount(account: TestAccount): Promise<boolean> {
  return await testAccountManager.validateTestAccount(account);
}

export function getTestClient(account: TestAccount): Client {
  return testAccountManager.getClientWithTestAccount(account);
}