import { Client, AccountId, PrivateKey, AccountInfoQuery } from '@hashgraph/sdk';
import { logger } from '../../utils/logger';

/**
 * Simple Hedera Validator
 * 
 * Provides basic Hedera network validation using the official SDK
 */
export class HederaValidator {
  private client: Client | null = null;
  private networkType: 'testnet' | 'mainnet';

  constructor() {
    this.networkType = (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet';
    this.initializeClient();
  }

  /**
   * Initialize Hedera Client
   */
  private initializeClient(): void {
    try {
      const accountId = process.env.HEDERA_ACCOUNT_ID;
      const privateKey = process.env.HEDERA_PRIVATE_KEY;

      if (!accountId || !privateKey) {
        logger.warn('Hedera credentials not found, using mock mode');
        return;
      }

      // Initialize client based on network
      if (this.networkType === 'mainnet') {
        this.client = Client.forMainnet();
      } else {
        this.client = Client.forTestnet();
      }

      this.client.setOperator(
        AccountId.fromString(accountId),
        PrivateKey.fromString(privateKey)
      );

      logger.info('Hedera Client initialized successfully', { network: this.networkType });

    } catch (error) {
      logger.error('Failed to initialize Hedera Client:', error);
      this.client = null;
    }
  }

  /**
   * Check Hedera network connection
   */
  async checkHederaConnection(): Promise<boolean> {
    if (!this.client) {
      logger.info('Hedera client not initialized - using mock mode');
      return true; // Return true for mock mode
    }

    try {
      const accountId = this.client.operatorAccountId;
      if (!accountId) {
        throw new Error('No operator account ID set');
      }

      // Try to get account info to verify connection
      const accountInfo = await new AccountInfoQuery()
        .setAccountId(accountId)
        .execute(this.client);

      logger.info('Hedera connection verified', {
        accountId: accountId.toString(),
        balance: accountInfo.balance.toString()
      });

      return true;

    } catch (error) {
      logger.error('Hedera connection failed:', error);
      return false;
    }
  }

  /**
   * Get client for operations (or null if mock mode)
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Check if running in mock mode
   */
  isMockMode(): boolean {
    return this.client === null;
  }
}

export default HederaValidator;