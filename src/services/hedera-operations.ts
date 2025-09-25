// Import Hedera Agent Kit with fallback handling
let HederaAgentAPI: any = null;
try {
  const agentKit = require('hedera-agent-kit');
  HederaAgentAPI = agentKit.HederaAgentAPI;
} catch (error) {
  // Agent Kit not available, will use fallback mode
}

import { Client, AccountId, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType, Hbar, TransactionResponse, TransactionReceipt, TokenAssociateTransaction, TransferTransaction, TokenId, ContractCreateTransaction, ContractExecuteTransaction, FileCreateTransaction, FileAppendTransaction, TopicCreateTransaction, TopicMessageSubmitTransaction, TopicId } from '@hashgraph/sdk';
import { logger } from '../utils/logger';
import { getTestAccount, validateTestAccount, getTestClient, TestAccount } from '../utils/test-accounts';

/**
 * Hedera Operations Service
 *
 * Provides real blockchain operations using Hedera Agent Kit and SDK
 * Handles token creation, transfers, and other blockchain operations
 */

export interface TokenCreationOptions {
  name: string;
  symbol: string;
  decimals?: number;
  initialSupply?: number;
  treasuryAccount?: string;
  adminKey?: boolean;
  supplyKey?: boolean;
  freezeKey?: boolean;
  wipeKey?: boolean;
  freezeDefault?: boolean;
}

export interface TokenOperationResult {
  success: boolean;
  tokenId?: string;
  transactionId?: string;
  explorerUrl?: string;
  error?: string;
  details?: any;
}

export interface TokenTransferOptions {
  tokenId: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
}

export interface SmartContractOptions {
  bytecode: string;
  gas: number;
  initialBalance?: number;
  constructorParameters?: any[];
  adminKey?: boolean;
}

export interface ContractCallOptions {
  contractId: string;
  functionName: string;
  parameters?: any[];
  gas: number;
  payableAmount?: number;
}

export interface TopicOptions {
  memo?: string;
  adminKey?: boolean;
  submitKey?: boolean;
  autoRenewPeriod?: number;
}

export interface TopicMessageOptions {
  topicId: string;
  message: string;
  submitKey?: string;
}

export class HederaOperationsService {
  private client: Client | null = null;
  private agentKit: any | null = null;
  private network: 'testnet' | 'mainnet';
  private testAccount: TestAccount | null = null;
  private initialized: boolean = false;

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.network = network;
  }

  /**
   * Initialize the service with credentials or test account
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Try to use environment credentials first
      const accountId = process.env.HEDERA_ACCOUNT_ID;
      const privateKey = process.env.HEDERA_PRIVATE_KEY;

      if (accountId && privateKey) {
        await this.initializeWithCredentials(accountId, privateKey);
        logger.info('Hedera Operations initialized with environment credentials');
      } else {
        await this.initializeWithTestAccount();
        logger.info('Hedera Operations initialized with test account');
      }

      this.initialized = true;
    } catch (error: any) {
      logger.error('Failed to initialize Hedera Operations:', error);
      throw new Error(`Hedera Operations initialization failed: ${error.message}`);
    }
  }

  /**
   * Initialize with provided credentials
   */
  private async initializeWithCredentials(accountId: string, privateKey: string): Promise<void> {
    // Initialize client
    if (this.network === 'mainnet') {
      this.client = Client.forMainnet();
    } else {
      this.client = Client.forTestnet();
    }

    this.client.setOperator(
      AccountId.fromString(accountId),
      PrivateKey.fromString(privateKey)
    );

    // Initialize Agent Kit if available
    if (HederaAgentAPI) {
      const context = {
        accountId,
        mode: 'EXECUTE' as const
      };

      this.agentKit = new HederaAgentAPI(this.client, context);
    } else {
      logger.warn('HederaAgentAPI not available, using direct SDK operations');
      this.agentKit = null;
    }

    logger.info('Initialized with user credentials', {
      network: this.network,
      accountId
    });
  }

  /**
   * Initialize with test account
   */
  private async initializeWithTestAccount(): Promise<void> {
    try {
      // Get test account
      this.testAccount = await getTestAccount();

      // Validate test account
      const isValid = await validateTestAccount(this.testAccount);
      if (!isValid) {
        throw new Error('Test account validation failed');
      }

      // Get client configured with test account
      this.client = getTestClient(this.testAccount);

      // Initialize Agent Kit with test account if available
      if (HederaAgentAPI) {
        const context = {
          accountId: this.testAccount.accountId,
          mode: 'EXECUTE' as const
        };

        this.agentKit = new HederaAgentAPI(this.client, context);
      } else {
        logger.warn('HederaAgentAPI not available, using direct SDK operations');
        this.agentKit = null;
      }

      logger.info('Initialized with test account', {
        network: this.network,
        accountId: this.testAccount.accountId
      });

    } catch (error: any) {
      logger.error('Test account initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new token using Agent Kit
   */
  async createToken(options: TokenCreationOptions): Promise<TokenOperationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if we have real credentials vs test accounts
    const hasRealCredentials = process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY;

    if (!this.client) {
      return {
        success: false,
        error: 'Hedera client not initialized - running in mock mode'
      };
    }

    // If using test accounts without real credentials, return simulation
    if (!hasRealCredentials && this.testAccount && (this.testAccount.accountId === '0.0.2' || this.testAccount.accountId === '0.0.3')) {
      logger.info('Simulating token creation with test account');
      return {
        success: true,
        tokenId: `0.0.${Math.floor(Math.random() * 1000000) + 100000}`, // Simulate token ID
        transactionId: `0.0.2@${Date.now()}-${Math.floor(Math.random() * 1000)}`, // Simulate transaction ID
        explorerUrl: `https://hashscan.io/testnet/token/0.0.${Math.floor(Math.random() * 1000000) + 100000}`,
        details: {
          name: options.name,
          symbol: options.symbol,
          decimals: options.decimals || 8,
          initialSupply: options.initialSupply || 1000000,
          network: this.network,
          note: 'This is a simulation using test account. Use real Hedera credentials for actual token creation.'
        }
      };
    }

    try {
      logger.info('Creating token with Agent Kit...', {
        name: options.name,
        symbol: options.symbol,
        decimals: options.decimals || 8,
        network: this.network
      });

      // Use Agent Kit to create token
      const tokenData = {
        name: options.name,
        symbol: options.symbol,
        decimals: options.decimals || 8,
        initialSupply: options.initialSupply || 1000000,
        treasuryAccountId: options.treasuryAccount || this.client.operatorAccountId?.toString(),
        adminKey: options.adminKey !== false, // Default to true
        supplyKey: options.supplyKey !== false, // Default to true
        freezeKey: options.freezeKey || false,
        wipeKey: options.wipeKey || false,
        freezeDefault: options.freezeDefault || false
      };

      // This would be the actual Agent Kit call
      // For now, we'll use direct SDK call as Agent Kit structure is being finalized
      const result = await this.createTokenWithSDK(tokenData);

      logger.info('Token creation completed', {
        success: result.success,
        tokenId: result.tokenId,
        transactionId: result.transactionId
      });

      return result;

    } catch (error: any) {
      logger.error('Token creation failed:', error);
      return {
        success: false,
        error: `Token creation failed: ${error.message}`,
        details: error
      };
    }
  }

  /**
   * Create token using direct Hedera SDK
   * (This bridges to Agent Kit as the integration matures)
   */
  private async createTokenWithSDK(tokenData: any): Promise<TokenOperationResult> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      // Get operator key for signing
      const operatorAccount = this.client.operatorAccountId;
      if (!operatorAccount) {
        throw new Error('No operator account configured');
      }

      // For token creation, we'll use the operator key from the test account or environment
      let operatorKey: PrivateKey;
      if (this.testAccount) {
        operatorKey = PrivateKey.fromString(this.testAccount.privateKey);
      } else {
        const privateKeyString = process.env.HEDERA_PRIVATE_KEY;
        if (!privateKeyString) {
          throw new Error('No private key available for signing');
        }
        operatorKey = PrivateKey.fromString(privateKeyString);
      }

      // Create token transaction
      const tokenCreateTx = new TokenCreateTransaction()
        .setTokenName(tokenData.name)
        .setTokenSymbol(tokenData.symbol)
        .setDecimals(tokenData.decimals)
        .setInitialSupply(tokenData.initialSupply)
        .setTreasuryAccountId(this.client.operatorAccountId!)
        .setTokenType(TokenType.FungibleCommon)
        .setSupplyType(TokenSupplyType.Infinite);

      // Add keys if specified
      if (tokenData.adminKey) {
        tokenCreateTx.setAdminKey(operatorKey.publicKey);
      }
      if (tokenData.supplyKey) {
        tokenCreateTx.setSupplyKey(operatorKey.publicKey);
      }
      if (tokenData.freezeKey) {
        tokenCreateTx.setFreezeKey(operatorKey.publicKey);
      }
      if (tokenData.wipeKey) {
        tokenCreateTx.setWipeKey(operatorKey.publicKey);
      }

      // Set freeze default
      if (tokenData.freezeDefault) {
        tokenCreateTx.setFreezeDefault(true);
      }

      // Set transaction fee (typical for token creation)
      tokenCreateTx.setMaxTransactionFee(new Hbar(30));

      logger.info('Submitting token creation transaction...');

      // Execute transaction
      const txResponse: TransactionResponse = await tokenCreateTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);

      const tokenId = receipt.tokenId;
      if (!tokenId) {
        throw new Error('Token ID not received in transaction receipt');
      }

      const explorerUrl = this.getExplorerUrl(tokenId.toString(), 'token');

      logger.info('Token created successfully!', {
        tokenId: tokenId.toString(),
        transactionId: txResponse.transactionId.toString(),
        explorerUrl
      });

      return {
        success: true,
        tokenId: tokenId.toString(),
        transactionId: txResponse.transactionId.toString(),
        explorerUrl,
        details: {
          name: tokenData.name,
          symbol: tokenData.symbol,
          decimals: tokenData.decimals,
          initialSupply: tokenData.initialSupply,
          network: this.network
        }
      };

    } catch (error: any) {
      logger.error('SDK token creation failed:', error);
      throw error;
    }
  }

  /**
   * Transfer tokens between accounts
   */
  async transferToken(options: TokenTransferOptions): Promise<TokenOperationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.client) {
      return {
        success: false,
        error: 'Hedera client not initialized - running in mock mode'
      };
    }

    // Check if using test accounts without real credentials - simulate transfer
    const hasRealCredentials = process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY;
    if (!hasRealCredentials && this.testAccount) {
      logger.info('Simulating token transfer with test account');
      return {
        success: true,
        transactionId: `0.0.2@${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        explorerUrl: this.getExplorerUrl(`0.0.2@${Date.now()}`, 'transaction'),
        details: {
          ...options,
          note: 'This is a simulation using test account. Use real Hedera credentials for actual transfers.'
        }
      };
    }

    try {
      logger.info('Executing token transfer on Hedera network...', {
        tokenId: options.tokenId,
        fromAccount: options.fromAccount,
        toAccount: options.toAccount,
        amount: options.amount,
        network: this.network
      });

      // Create the transfer transaction
      const transferTx = new TransferTransaction()
        .addTokenTransfer(
          TokenId.fromString(options.tokenId),
          AccountId.fromString(options.fromAccount),
          -options.amount // Negative amount for sender
        )
        .addTokenTransfer(
          TokenId.fromString(options.tokenId),
          AccountId.fromString(options.toAccount),
          options.amount // Positive amount for receiver
        )
        .setMaxTransactionFee(new Hbar(2)); // Set reasonable fee

      logger.info('Submitting token transfer transaction...');

      // Execute the transaction
      const txResponse: TransactionResponse = await transferTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);

      const transactionId = txResponse.transactionId.toString();
      const explorerUrl = this.getExplorerUrl(transactionId, 'transaction');

      logger.info('Token transfer completed successfully!', {
        transactionId,
        tokenId: options.tokenId,
        fromAccount: options.fromAccount,
        toAccount: options.toAccount,
        amount: options.amount,
        explorerUrl
      });

      return {
        success: true,
        transactionId,
        explorerUrl,
        details: {
          tokenId: options.tokenId,
          fromAccount: options.fromAccount,
          toAccount: options.toAccount,
          amount: options.amount,
          network: this.network,
          receiptStatus: receipt.status.toString()
        }
      };

    } catch (error: any) {
      logger.error('Token transfer failed:', error);
      return {
        success: false,
        error: `Token transfer failed: ${error.message}`,
        details: {
          ...options,
          errorCode: error.status?.toString(),
          errorDetails: error.message
        }
      };
    }
  }

  /**
   * Deploy a smart contract to Hedera network
   */
  async deploySmartContract(options: SmartContractOptions): Promise<TokenOperationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.client) {
      return {
        success: false,
        error: 'Hedera client not initialized - running in mock mode'
      };
    }

    // Check if using test accounts without real credentials - simulate deployment
    const hasRealCredentials = process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY;
    if (!hasRealCredentials && this.testAccount) {
      logger.info('Simulating smart contract deployment with test account');
      return {
        success: true,
        tokenId: `0.0.${Math.floor(Math.random() * 1000000) + 500000}`, // Contract ID
        transactionId: `0.0.2@${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        explorerUrl: this.getExplorerUrl(`0.0.${Math.floor(Math.random() * 1000000) + 500000}`, 'account'),
        details: {
          gas: options.gas,
          initialBalance: options.initialBalance || 0,
          network: this.network,
          note: 'This is a simulation using test account. Use real Hedera credentials for actual contract deployment.'
        }
      };
    }

    try {
      logger.info('Deploying smart contract to Hedera network...', {
        gas: options.gas,
        initialBalance: options.initialBalance || 0,
        network: this.network
      });

      // First, create a file to store the bytecode
      const fileCreateTx = new FileCreateTransaction()
        .setContents(options.bytecode)
        .setMaxTransactionFee(new Hbar(2));

      // Add keys if specified
      if (options.adminKey) {
        const operatorKey = this.testAccount
          ? PrivateKey.fromString(this.testAccount.privateKey)
          : PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY!);
        fileCreateTx.setKeys([operatorKey.publicKey]);
      }

      logger.info('Creating bytecode file...');
      const fileResponse = await fileCreateTx.execute(this.client);
      const fileReceipt = await fileResponse.getReceipt(this.client);

      if (!fileReceipt.fileId) {
        throw new Error('Failed to create bytecode file');
      }

      logger.info('Bytecode file created:', { fileId: fileReceipt.fileId.toString() });

      // Now create the contract
      const contractCreateTx = new ContractCreateTransaction()
        .setBytecodeFileId(fileReceipt.fileId)
        .setGas(options.gas)
        .setInitialBalance(Hbar.fromTinybars(options.initialBalance || 0))
        .setMaxTransactionFee(new Hbar(20));

      // Add constructor parameters if provided
      if (options.constructorParameters && options.constructorParameters.length > 0) {
        // Note: For real implementation, you'd need to properly encode parameters
        logger.info('Constructor parameters provided:', options.constructorParameters);
      }

      logger.info('Deploying smart contract...');
      const contractResponse = await contractCreateTx.execute(this.client);
      const contractReceipt = await contractResponse.getReceipt(this.client);

      if (!contractReceipt.contractId) {
        throw new Error('Failed to get contract ID from deployment');
      }

      const contractId = contractReceipt.contractId.toString();
      const transactionId = contractResponse.transactionId.toString();
      const explorerUrl = this.getExplorerUrl(contractId, 'account');

      logger.info('Smart contract deployed successfully!', {
        contractId,
        transactionId,
        fileId: fileReceipt.fileId.toString(),
        explorerUrl
      });

      return {
        success: true,
        tokenId: contractId, // Using tokenId field for contract ID
        transactionId,
        explorerUrl,
        details: {
          contractId,
          fileId: fileReceipt.fileId.toString(),
          gas: options.gas,
          initialBalance: options.initialBalance || 0,
          network: this.network
        }
      };

    } catch (error: any) {
      logger.error('Smart contract deployment failed:', error);
      return {
        success: false,
        error: `Smart contract deployment failed: ${error.message}`,
        details: {
          ...options,
          errorCode: error.status?.toString(),
          errorDetails: error.message
        }
      };
    }
  }

  /**
   * Call a smart contract function
   */
  async callSmartContract(options: ContractCallOptions): Promise<TokenOperationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.client) {
      return {
        success: false,
        error: 'Hedera client not initialized - running in mock mode'
      };
    }

    // Check if using test accounts without real credentials - simulate call
    const hasRealCredentials = process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY;
    if (!hasRealCredentials && this.testAccount) {
      logger.info('Simulating smart contract call with test account');
      return {
        success: true,
        transactionId: `0.0.2@${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        explorerUrl: this.getExplorerUrl(`0.0.2@${Date.now()}`, 'transaction'),
        details: {
          ...options,
          result: 'mock-result',
          note: 'This is a simulation using test account. Use real Hedera credentials for actual contract calls.'
        }
      };
    }

    try {
      logger.info('Calling smart contract function...', {
        contractId: options.contractId,
        functionName: options.functionName,
        gas: options.gas,
        network: this.network
      });

      // Create contract call transaction
      const contractCallTx = new ContractExecuteTransaction()
        .setContractId(options.contractId)
        .setGas(options.gas)
        .setMaxTransactionFee(new Hbar(2));

      // Add payable amount if specified
      if (options.payableAmount && options.payableAmount > 0) {
        contractCallTx.setPayableAmount(Hbar.fromTinybars(options.payableAmount));
      }

      // Note: For real implementation, you'd need to properly encode function call data
      // This would typically use ContractFunctionParameters for parameter encoding
      if (options.parameters && options.parameters.length > 0) {
        logger.info('Function parameters provided:', options.parameters);
      }

      logger.info('Executing contract call...');
      const callResponse = await contractCallTx.execute(this.client);
      const callReceipt = await callResponse.getReceipt(this.client);

      const transactionId = callResponse.transactionId.toString();
      const explorerUrl = this.getExplorerUrl(transactionId, 'transaction');

      logger.info('Smart contract call completed!', {
        contractId: options.contractId,
        functionName: options.functionName,
        transactionId,
        explorerUrl
      });

      return {
        success: true,
        transactionId,
        explorerUrl,
        details: {
          contractId: options.contractId,
          functionName: options.functionName,
          gas: options.gas,
          payableAmount: options.payableAmount || 0,
          network: this.network,
          receiptStatus: callReceipt.status.toString()
        }
      };

    } catch (error: any) {
      logger.error('Smart contract call failed:', error);
      return {
        success: false,
        error: `Smart contract call failed: ${error.message}`,
        details: {
          ...options,
          errorCode: error.status?.toString(),
          errorDetails: error.message
        }
      };
    }
  }

  /**
   * Create a Hedera Consensus Service (HCS) topic
   */
  async createTopic(options: TopicOptions = {}): Promise<TokenOperationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.client) {
      return {
        success: false,
        error: 'Hedera client not initialized - running in mock mode'
      };
    }

    // Check if using test accounts without real credentials - simulate topic creation
    const hasRealCredentials = process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY;
    if (!hasRealCredentials && this.testAccount) {
      logger.info('Simulating HCS topic creation with test account');
      return {
        success: true,
        tokenId: `0.0.${Math.floor(Math.random() * 1000000) + 700000}`, // Topic ID
        transactionId: `0.0.2@${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        explorerUrl: this.getExplorerUrl(`0.0.${Math.floor(Math.random() * 1000000) + 700000}`, 'account'),
        details: {
          memo: options.memo || '',
          network: this.network,
          note: 'This is a simulation using test account. Use real Hedera credentials for actual topic creation.'
        }
      };
    }

    try {
      logger.info('Creating HCS topic...', {
        memo: options.memo,
        network: this.network
      });

      // Create topic transaction
      const topicCreateTx = new TopicCreateTransaction()
        .setMaxTransactionFee(new Hbar(2));

      // Add memo if provided
      if (options.memo) {
        topicCreateTx.setTopicMemo(options.memo);
      }

      // Add keys if specified
      if (options.adminKey || options.submitKey) {
        const operatorKey = this.testAccount
          ? PrivateKey.fromString(this.testAccount.privateKey)
          : PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY!);

        if (options.adminKey) {
          topicCreateTx.setAdminKey(operatorKey.publicKey);
        }
        if (options.submitKey) {
          topicCreateTx.setSubmitKey(operatorKey.publicKey);
        }
      }

      // Set auto renew period if specified
      if (options.autoRenewPeriod) {
        topicCreateTx.setAutoRenewPeriod(options.autoRenewPeriod);
      }

      logger.info('Submitting topic creation transaction...');
      const topicResponse = await topicCreateTx.execute(this.client);
      const topicReceipt = await topicResponse.getReceipt(this.client);

      if (!topicReceipt.topicId) {
        throw new Error('Failed to get topic ID from creation');
      }

      const topicId = topicReceipt.topicId.toString();
      const transactionId = topicResponse.transactionId.toString();
      const explorerUrl = this.getExplorerUrl(topicId, 'account');

      logger.info('HCS topic created successfully!', {
        topicId,
        transactionId,
        memo: options.memo,
        explorerUrl
      });

      return {
        success: true,
        tokenId: topicId, // Using tokenId field for topic ID
        transactionId,
        explorerUrl,
        details: {
          topicId,
          memo: options.memo || '',
          adminKey: !!options.adminKey,
          submitKey: !!options.submitKey,
          network: this.network
        }
      };

    } catch (error: any) {
      logger.error('HCS topic creation failed:', error);
      return {
        success: false,
        error: `HCS topic creation failed: ${error.message}`,
        details: {
          ...options,
          errorCode: error.status?.toString(),
          errorDetails: error.message
        }
      };
    }
  }

  /**
   * Submit a message to an HCS topic
   */
  async submitTopicMessage(options: TopicMessageOptions): Promise<TokenOperationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.client) {
      return {
        success: false,
        error: 'Hedera client not initialized - running in mock mode'
      };
    }

    // Check if using test accounts without real credentials - simulate message submission
    const hasRealCredentials = process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY;
    if (!hasRealCredentials && this.testAccount) {
      logger.info('Simulating HCS message submission with test account');
      return {
        success: true,
        transactionId: `0.0.2@${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        explorerUrl: this.getExplorerUrl(`0.0.2@${Date.now()}`, 'transaction'),
        details: {
          ...options,
          sequenceNumber: Math.floor(Math.random() * 10000) + 1,
          note: 'This is a simulation using test account. Use real Hedera credentials for actual message submission.'
        }
      };
    }

    try {
      logger.info('Submitting message to HCS topic...', {
        topicId: options.topicId,
        messageLength: options.message.length,
        network: this.network
      });

      // Create topic message transaction
      const topicMessageTx = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(options.topicId))
        .setMessage(options.message)
        .setMaxTransactionFee(new Hbar(2));

      logger.info('Submitting topic message transaction...');
      const messageResponse = await topicMessageTx.execute(this.client);
      const messageReceipt = await messageResponse.getReceipt(this.client);

      const transactionId = messageResponse.transactionId.toString();
      const explorerUrl = this.getExplorerUrl(transactionId, 'transaction');

      logger.info('HCS message submitted successfully!', {
        topicId: options.topicId,
        transactionId,
        messageLength: options.message.length,
        explorerUrl
      });

      return {
        success: true,
        transactionId,
        explorerUrl,
        details: {
          topicId: options.topicId,
          message: options.message,
          messageLength: options.message.length,
          network: this.network,
          receiptStatus: messageReceipt.status.toString()
        }
      };

    } catch (error: any) {
      logger.error('HCS message submission failed:', error);
      return {
        success: false,
        error: `HCS message submission failed: ${error.message}`,
        details: {
          ...options,
          errorCode: error.status?.toString(),
          errorDetails: error.message
        }
      };
    }
  }

  /**
   * Get Hedera Explorer URL for transaction or entity
   */
  private getExplorerUrl(id: string, type: 'transaction' | 'token' | 'account'): string {
    const baseUrl = this.network === 'mainnet'
      ? 'https://hashscan.io/mainnet'
      : 'https://hashscan.io/testnet';

    return `${baseUrl}/${type}/${id}`;
  }

  /**
   * Check if service is running in mock mode
   */
  isMockMode(): boolean {
    return !this.client || !this.agentKit;
  }

  /**
   * Get current network
   */
  getNetwork(): 'testnet' | 'mainnet' {
    return this.network;
  }

  /**
   * Get current account ID
   */
  getCurrentAccountId(): string | null {
    if (this.testAccount) {
      return this.testAccount.accountId;
    }
    return this.client?.operatorAccountId?.toString() || null;
  }

  /**
   * Close client connections
   */
  close(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
      this.agentKit = null;
      this.initialized = false;
    }
  }
}

// Export singleton instance
export const hederaOperations = new HederaOperationsService(
  (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet'
);

// Helper functions
export async function createToken(options: TokenCreationOptions): Promise<TokenOperationResult> {
  return await hederaOperations.createToken(options);
}

export async function transferToken(options: TokenTransferOptions): Promise<TokenOperationResult> {
  return await hederaOperations.transferToken(options);
}

export async function deploySmartContract(options: SmartContractOptions): Promise<TokenOperationResult> {
  return await hederaOperations.deploySmartContract(options);
}

export async function callSmartContract(options: ContractCallOptions): Promise<TokenOperationResult> {
  return await hederaOperations.callSmartContract(options);
}

export async function createTopic(options: TopicOptions = {}): Promise<TokenOperationResult> {
  return await hederaOperations.createTopic(options);
}

export async function submitTopicMessage(options: TopicMessageOptions): Promise<TokenOperationResult> {
  return await hederaOperations.submitTopicMessage(options);
}