import { Client, AccountId, PrivateKey, AccountInfoQuery } from '@hashgraph/sdk';
import { logger } from '../../utils/logger';
import { HederaAgentKitService } from '../../services/hedera-agent-kit-service';

/**
 * Enhanced Hedera Validator with HederaAgentKit Integration
 * 
 * Provides comprehensive Hedera network validation using both AgentKit and direct SDK
 */
export class HederaValidator {
  private client: Client | null = null;
  private agentKitService: HederaAgentKitService | null = null;
  private networkType: 'testnet' | 'mainnet';

  constructor() {
    this.networkType = (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet';
    this.initializeServices();
  }

  /**
   * Initialize both HederaAgentKit and direct SDK client
   */
  private async initializeServices(): Promise<void> {
    try {
      const accountId = process.env.HEDERA_ACCOUNT_ID;
      const privateKey = process.env.HEDERA_PRIVATE_KEY;

      if (!accountId || !privateKey) {
        logger.warn('Hedera credentials not found - validation will use fallback mode');
        return;
      }

      // Initialize HederaAgentKit service
      this.agentKitService = new HederaAgentKitService({
        accountId,
        privateKey,
        network: this.networkType
      });

      await this.agentKitService.initialize();

      // Initialize direct SDK client as fallback
      this.initializeDirectClient(accountId, privateKey);

      logger.internal('info', 'Hedera Validator initialized with AgentKit and SDK', { 
        network: this.networkType,
        agentKitAvailable: this.agentKitService.isAvailable()
      });

    } catch (error) {
      logger.error('Failed to initialize Hedera Validator:', error);
      this.client = null;
      this.agentKitService = null;
    }
  }

  /**
   * Initialize direct Hedera SDK client
   */
  private initializeDirectClient(accountId: string, privateKey: string): void {
    try {
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

      logger.internal('info', 'Direct Hedera Client initialized successfully', { network: this.networkType });

    } catch (error) {
      logger.error('Failed to initialize direct Hedera Client:', error);
      this.client = null;
    }
  }

  /**
   * Check Hedera network connection using AgentKit first, fallback to direct SDK
   */
  async checkHederaConnection(): Promise<boolean> {
    // Try AgentKit first if available
    if (this.agentKitService && this.agentKitService.isAvailable()) {
      try {
        const isConnected = await this.agentKitService.isConnected();
        if (isConnected) {
          logger.internal('info', 'Hedera connection verified via AgentKit');
          return true;
        }
      } catch (error) {
        logger.warn('AgentKit connection check failed, trying direct SDK', error);
      }
    }

    // Fallback to direct SDK
    if (!this.client) {
      logger.warn('No Hedera client available - running in fallback mode');
      return false;
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

      logger.internal('info', 'Hedera connection verified via direct SDK', {
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
   * Validate token operation using AgentKit or direct SDK
   */
  async validateTokenOperation(tokenId: string): Promise<{ valid: boolean; message: string }> {
    // Try AgentKit first
    if (this.agentKitService && this.agentKitService.isAvailable()) {
      const result = await this.agentKitService.validateTokenOperation(tokenId);
      return {
        valid: result.success,
        message: result.success ? 'Token validation successful via AgentKit' : result.error || 'Token validation failed'
      };
    }

    // Fallback to basic validation
    const isValid = Boolean(tokenId && tokenId.startsWith('0.0.'));
    return {
      valid: isValid,
      message: isValid ? 'Basic token format validation passed' : 'Invalid token format'
    };
  }

  /**
   * Validate consensus operation using AgentKit or direct SDK
   */
  async validateConsensusOperation(topicId: string): Promise<{ valid: boolean; message: string }> {
    // Try AgentKit first
    if (this.agentKitService && this.agentKitService.isAvailable()) {
      const result = await this.agentKitService.validateConsensusOperation(topicId);
      return {
        valid: result.success,
        message: result.success ? 'Consensus validation successful via AgentKit' : result.error || 'Consensus validation failed'
      };
    }

    // Fallback to basic validation
    const isValid = Boolean(topicId && topicId.startsWith('0.0.'));
    return {
      valid: isValid,
      message: isValid ? 'Basic topic format validation passed' : 'Invalid topic format'
    };
  }

  /**
   * Validate smart contract operation using basic format validation
   */
  async validateContractOperation(contractId: string): Promise<{ valid: boolean; message: string }> {
    // Basic contract ID format validation
    const isValid = Boolean(contractId && contractId.startsWith('0.0.'));
    return {
      valid: isValid,
      message: isValid ? 'Contract ID format validation passed' : 'Invalid contract ID format'
    };
  }

  /**
   * Validate account balance using AgentKit or direct SDK
   */
  async validateAccountBalance(accountId: string): Promise<{ valid: boolean; balance: string }> {
    // Try AgentKit first
    if (this.agentKitService && this.agentKitService.isAvailable()) {
      const result = await this.agentKitService.validateAccountBalance(accountId);
      if (result.success && result.data) {
        return {
          valid: true,
          balance: result.data.balance || '0'
        };
      }
    }

    // Fallback to direct SDK if available
    if (this.client) {
      try {
        const accountInfo = await new AccountInfoQuery()
          .setAccountId(AccountId.fromString(accountId))
          .execute(this.client);
        
        return {
          valid: true,
          balance: accountInfo.balance.toString()
        };
      } catch (error) {
        logger.error('Account balance validation failed', error);
      }
    }

    return {
      valid: false,
      balance: '0'
    };
  }

  /**
   * Get client for operations (or null if not available)
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Get HederaAgentKit service instance
   */
  getAgentKitService(): HederaAgentKitService | null {
    return this.agentKitService;
  }

  /**
   * Check if AgentKit is available
   */
  isAgentKitAvailable(): boolean {
    return this.agentKitService ? this.agentKitService.isAvailable() : false;
  }

  /**
   * Check if running in fallback mode (no credentials)
   */
  isFallbackMode(): boolean {
    return this.client === null && (this.agentKitService === null || !this.agentKitService.isAvailable());
  }
}

export default HederaValidator;