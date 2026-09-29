import {
  Client, AccountId, PrivateKey, TokenCreateTransaction, TokenMintTransaction, TokenType, TokenSupplyType, Hbar,
  TransferTransaction, TokenId, ContractCreateFlow, ContractExecuteTransaction, ContractCallQuery,
  ContractFunctionParameters, ContractId, TopicCreateTransaction, TopicMessageSubmitTransaction, TopicId, Status
} from '@hashgraph/sdk';
import { logger } from '../utils/logger';
import { EnvironmentValidator } from '../utils/environment-validator';
import { InputSanitizer } from '../utils/input-sanitizer';

/**
 * Hedera Operations Service
 *
 * Real Hedera operations through the Hedera SDK. hedera-agent-kit is not
 * initialised (nothing uses it). Every operation that reports
 * success carries the entity and/or transaction ID from the network's
 * receipt; if the receipt lacks one, the operation fails instead.
 */

export interface TokenCreationOptions {
  name: string;
  symbol: string;
  decimals?: number;
  /** In the token's smallest unit: 100000 with 2 decimals is 1,000.00 tokens */
  initialSupply?: number;
  /** Smallest units. Given: FINITE supply capped here. Omitted: INFINITE supply */
  maxSupply?: number;
  /** Must be the operator account (the only key APIX can sign with) */
  treasuryAccount?: string;
  /** Each key flag sets that key to the operator's public key */
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

export interface TokenMintOptions {
  tokenId: string;
  /** Smallest units */
  amount: number;
}

/** A Solidity argument, encoded with ContractFunctionParameters */
export type ContractParam =
  | { type: 'string'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'uint256' | 'int256'; value: number | string | bigint }
  | { type: 'address'; value: string }
  | { type: 'bytes32'; value: string | Uint8Array };

export type ContractReturnType = 'string' | 'bool' | 'uint256' | 'address';

export interface SmartContractOptions {
  /** Compiled bytecode as hex, with or without a 0x prefix */
  bytecode: string;
  gas: number;
  initialBalance?: number;
  constructorParameters?: ContractParam[];
  adminKey?: boolean;
}

export interface ContractCallOptions {
  contractId: string;
  functionName: string;
  parameters?: ContractParam[];
  gas: number;
  payableAmount?: number;
}

export interface ContractQueryOptions {
  contractId: string;
  functionName: string;
  parameters?: ContractParam[];
  /** The function's single return value, decoded as this type */
  returns: ContractReturnType;
  gas?: number;
}

export interface ContractQueryResult {
  success: true;
  /** string and address as strings, bool as boolean, uint256 as a decimal string */
  value: string | boolean;
  details: { contractId: string; functionName: string; gasUsed: string; network: string };
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

type InputCheck = { valid: boolean; error?: string };
type ExplorerPage = 'transaction' | 'token' | 'topic' | 'contract' | 'account';

/**
 * Throw before any SDK call if any input check failed.
 */
function assertValidInput(operation: string, checks: InputCheck[]): void {
  const errors = checks.filter(check => !check.valid).map(check => check.error);
  if (errors.length > 0) {
    throw new Error(`Invalid ${operation} input:\n${errors.map(error => `  - ${error}`).join('\n')}`);
  }
}

const UINT256_MAX = (BigInt(1) << BigInt(256)) - BigInt(1);
const INT256_MIN = -(BigInt(1) << BigInt(255));
const INT256_MAX = (BigInt(1) << BigInt(255)) - BigInt(1);

function toBigInt(value: number | string | bigint, label: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer (pass larger values as a string or bigint)`);
    return BigInt(value);
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
  throw new Error(`${label} must be an integer`);
}

/**
 * The SDK converts integer arguments with its own bignumber.js and accepts a
 * decimal string (a BigNumber from another copy of the library is rejected),
 * so 256-bit values go in as strings; the declared type is wider than needed.
 */
function toSdkInteger(value: bigint): Parameters<ContractFunctionParameters['addUint256']>[0] {
  return value.toString(10) as unknown as Parameters<ContractFunctionParameters['addUint256']>[0];
}

function validateSolidityName(name: string): InputCheck {
  return typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
    ? { valid: true }
    : { valid: false, error: `Invalid function name: "${name}"` };
}

/**
 * Encode arguments for a contract function. Throws on a value that doesn't
 * fit its declared type, so nothing malformed reaches the network.
 */
export function buildContractParameters(params: ContractParam[] = []): ContractFunctionParameters {
  const encoded = new ContractFunctionParameters();
  params.forEach((param, index) => {
    const label = `Parameter ${index + 1} (${param?.type})`;
    switch (param?.type) {
      case 'string':
        if (typeof param.value !== 'string') throw new Error(`${label} must be a string`);
        encoded.addString(param.value);
        break;
      case 'bool':
        if (typeof param.value !== 'boolean') throw new Error(`${label} must be true or false`);
        encoded.addBool(param.value);
        break;
      case 'uint256': {
        const value = toBigInt(param.value, label);
        if (value < BigInt(0) || value > UINT256_MAX) throw new Error(`${label} is out of range for uint256`);
        encoded.addUint256(toSdkInteger(value));
        break;
      }
      case 'int256': {
        const value = toBigInt(param.value, label);
        if (value < INT256_MIN || value > INT256_MAX) throw new Error(`${label} is out of range for int256`);
        encoded.addInt256(toSdkInteger(value));
        break;
      }
      case 'address': {
        const value = typeof param.value === 'string' ? param.value.trim() : '';
        let evm: string;
        if (/^0x[0-9a-fA-F]{40}$/.test(value)) {
          evm = value.slice(2);
        } else if (/^\d+\.\d+\.\d+$/.test(value)) {
          evm = AccountId.fromString(value).toSolidityAddress();
        } else {
          throw new Error(`${label} must be a 0x-prefixed 20-byte EVM address or a 0.0.x ID`);
        }
        encoded.addAddress(evm);
        break;
      }
      case 'bytes32': {
        let bytes: Uint8Array;
        if (param.value instanceof Uint8Array) {
          bytes = param.value;
        } else if (typeof param.value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(param.value.trim())) {
          bytes = Uint8Array.from(Buffer.from(param.value.trim().slice(2), 'hex'));
        } else {
          throw new Error(`${label} must be 32 bytes (0x followed by 64 hex characters)`);
        }
        if (bytes.length !== 32) throw new Error(`${label} must be exactly 32 bytes`);
        encoded.addBytes32(bytes);
        break;
      }
      default:
        throw new Error(`${label}: unsupported type; use string, bool, uint256, int256, address or bytes32`);
    }
  });
  return encoded;
}

/** Hex digits of the bytecode, without a 0x prefix */
function normalizeBytecode(bytecode: string): string {
  const hex = typeof bytecode === 'string' ? bytecode.trim().replace(/^0x/, '') : '';
  if (!hex) throw new Error('Invalid contract deployment input:\n  - Bytecode is required');
  if (!/^[0-9a-fA-F]+$/.test(hex)) throw new Error('Invalid contract deployment input:\n  - Bytecode must be valid hexadecimal');
  if (hex.length % 2 !== 0) throw new Error('Invalid contract deployment input:\n  - Bytecode must have an even number of hex characters');
  return hex;
}

/** The receipt must name the entity the operation created */
function requireReceiptId<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`The network receipt has no ${what}; the operation cannot be confirmed`);
  }
  return value;
}

function failure(operation: string, error: any, details: Record<string, unknown>): TokenOperationResult {
  return {
    success: false,
    error: `${operation} failed: ${error?.message ?? String(error)}`,
    details: { ...details, errorCode: error?.status?.toString(), errorDetails: error?.message }
  };
}

export class HederaOperationsService {
  private client: Client | null = null;
  private network: 'testnet' | 'mainnet';
  private operatorKey: PrivateKey | null = null;
  private initialized: boolean = false;

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.network = network;
  }

  /**
   * Initialize the service from HEDERA_ACCOUNT_ID / HEDERA_PRIVATE_KEY.
   * Throws if the credentials are missing or invalid; there is no fallback.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const { accountId, privateKey } = EnvironmentValidator.requireHederaCredentials();

    try {
      await this.initializeWithCredentials(accountId, privateKey);
      logger.internal('info', 'Hedera Operations initialized with environment credentials', { network: this.network });

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

    try {
      this.operatorKey = PrivateKey.fromString(privateKey);
      this.client.setOperator(AccountId.fromString(accountId), this.operatorKey);
    } catch (error) {
      // Don't leak the Client (and its network timers) on bad credentials
      this.client.close();
      this.client = null;
      this.operatorKey = null;
      throw error;
    }

    logger.internal('info', 'Direct SDK client configured successfully');

    logger.info('Initialized with user credentials', {
      network: this.network,
      accountId
    });
  }

  private async requireClient(): Promise<Client> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.client) {
      throw new Error(
        'Hedera client not initialized. ' +
        'Please ensure HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY are set.'
      );
    }
    return this.client;
  }

  /**
   * Create a fungible token with the Hedera SDK. The operator is the
   * treasury; key flags set that key to the operator's public key.
   */
  async createToken(options: TokenCreationOptions): Promise<TokenOperationResult> {
    const tokenInput = InputSanitizer.validateTokenCreation(options);
    const maxSupplyCheck: InputCheck = options.maxSupply === undefined
      ? { valid: true }
      : !Number.isSafeInteger(options.maxSupply) || options.maxSupply <= 0
        ? { valid: false, error: 'Max supply must be a positive whole number (smallest units)' }
        : (options.initialSupply ?? 1000000) > options.maxSupply
          ? { valid: false, error: 'Initial supply cannot exceed max supply' }
          : { valid: true };
    assertValidInput('token creation', [
      ...tokenInput.errors.map(error => ({ valid: false, error })),
      options.treasuryAccount ? InputSanitizer.validateAccountIdFormat(options.treasuryAccount) : { valid: true },
      maxSupplyCheck
    ]);
    options = { ...options, ...tokenInput.sanitized };

    const client = await this.requireClient();
    const operatorAccount = requireReceiptId(client.operatorAccountId, 'operator account');
    if (options.treasuryAccount && options.treasuryAccount !== operatorAccount.toString()) {
      throw new Error(
        `Invalid token creation input:\n  - The treasury must be the operator account (${operatorAccount}); ` +
        'APIX can only sign with the operator key'
      );
    }

    const decimals = options.decimals ?? 8;
    const initialSupply = options.initialSupply ?? 1000000;
    const finite = options.maxSupply !== undefined;

    try {
      const operatorKey = this.requireOperatorKey();
      const transaction = new TokenCreateTransaction()
        .setTokenName(options.name)
        .setTokenSymbol(options.symbol)
        .setDecimals(decimals)
        .setInitialSupply(initialSupply)
        .setTreasuryAccountId(operatorAccount)
        .setTokenType(TokenType.FungibleCommon)
        .setSupplyType(finite ? TokenSupplyType.Finite : TokenSupplyType.Infinite)
        .setFreezeDefault(options.freezeDefault === true)
        .setMaxTransactionFee(new Hbar(30));

      if (finite) transaction.setMaxSupply(options.maxSupply!);
      if (options.adminKey) transaction.setAdminKey(operatorKey.publicKey);
      if (options.supplyKey) transaction.setSupplyKey(operatorKey.publicKey);
      if (options.freezeKey) transaction.setFreezeKey(operatorKey.publicKey);
      if (options.wipeKey) transaction.setWipeKey(operatorKey.publicKey);

      logger.info('Submitting token creation transaction...');
      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);
      const tokenId = requireReceiptId(receipt.tokenId, 'token ID').toString();
      const transactionId = response.transactionId.toString();

      return {
        success: true,
        tokenId,
        transactionId,
        explorerUrl: this.getExplorerUrl(tokenId, 'token'),
        details: {
          name: options.name,
          symbol: options.symbol,
          decimals,
          initialSupply,
          supplyType: finite ? 'FINITE' : 'INFINITE',
          maxSupply: options.maxSupply,
          keys: {
            admin: options.adminKey === true,
            supply: options.supplyKey === true,
            freeze: options.freezeKey === true,
            wipe: options.wipeKey === true
          },
          treasury: operatorAccount.toString(),
          network: this.network,
          method: 'Hedera SDK',
          transactionUrl: this.getExplorerUrl(transactionId, 'transaction')
        }
      };
    } catch (error: any) {
      logger.error('Token creation failed:', error);
      return failure('Token creation', error, { name: options.name, symbol: options.symbol });
    }
  }

  /**
   * Mint more of a token (needs the token's supply key to be the operator key)
   */
  async mintToken(options: TokenMintOptions): Promise<TokenOperationResult> {
    assertValidInput('token mint', [
      InputSanitizer.validateTokenIdFormat(options.tokenId),
      InputSanitizer.validateTransferAmount(options.amount)
    ]);
    const client = await this.requireClient();

    try {
      const response = await new TokenMintTransaction()
        .setTokenId(TokenId.fromString(options.tokenId))
        .setAmount(options.amount)
        .setMaxTransactionFee(new Hbar(5))
        .execute(client);
      const receipt = await response.getReceipt(client);
      const transactionId = response.transactionId.toString();
      const totalSupply = requireReceiptId(receipt.totalSupply, 'new total supply').toString();

      return {
        success: true,
        tokenId: options.tokenId,
        transactionId,
        explorerUrl: this.getExplorerUrl(transactionId, 'transaction'),
        details: { amount: options.amount, totalSupply, network: this.network, receiptStatus: receipt.status.toString() }
      };
    } catch (error: any) {
      logger.error('Token mint failed:', error);
      return failure('Token mint', error, { ...options });
    }
  }

  /**
   * Transfer tokens between accounts
   */
  async transferToken(options: TokenTransferOptions): Promise<TokenOperationResult> {
    assertValidInput('token transfer', [
      InputSanitizer.validateTokenIdFormat(options.tokenId),
      InputSanitizer.validateAccountIdFormat(options.fromAccount),
      InputSanitizer.validateAccountIdFormat(options.toAccount),
      InputSanitizer.validateTransferAmount(options.amount)
    ]);
    const client = await this.requireClient();

    try {
      const response = await new TransferTransaction()
        .addTokenTransfer(TokenId.fromString(options.tokenId), AccountId.fromString(options.fromAccount), -options.amount)
        .addTokenTransfer(TokenId.fromString(options.tokenId), AccountId.fromString(options.toAccount), options.amount)
        .setMaxTransactionFee(new Hbar(2))
        .execute(client);
      const receipt = await response.getReceipt(client);
      if (receipt.status !== Status.Success) {
        throw new Error(`Transfer receipt status ${receipt.status.toString()}`);
      }
      const transactionId = response.transactionId.toString();

      return {
        success: true,
        transactionId,
        explorerUrl: this.getExplorerUrl(transactionId, 'transaction'),
        details: { ...options, network: this.network, receiptStatus: receipt.status.toString() }
      };
    } catch (error: any) {
      logger.error('Token transfer failed:', error);
      return failure('Token transfer', error, { ...options });
    }
  }

  /**
   * Deploy compiled contract bytecode (ContractCreateFlow uploads it to a
   * file first, in chunks if needed)
   */
  async deploySmartContract(options: SmartContractOptions): Promise<TokenOperationResult> {
    assertValidInput('contract deployment', [
      InputSanitizer.validateGasLimit(options.gas),
      InputSanitizer.validateOptionalAmount(options.initialBalance, 'Initial balance')
    ]);
    const bytecode = normalizeBytecode(options.bytecode);
    const constructorParameters = options.constructorParameters?.length
      ? buildContractParameters(options.constructorParameters)
      : undefined;
    const client = await this.requireClient();

    try {
      const flow = new ContractCreateFlow()
        .setBytecode(bytecode)
        .setGas(options.gas)
        .setInitialBalance(Hbar.fromTinybars(options.initialBalance || 0));
      if (constructorParameters) flow.setConstructorParameters(constructorParameters);
      if (options.adminKey) flow.setAdminKey(this.requireOperatorKey().publicKey);

      logger.info('Deploying smart contract...');
      const response = await flow.execute(client);
      const receipt = await response.getReceipt(client);
      const contractId = requireReceiptId(receipt.contractId, 'contract ID').toString();
      const transactionId = response.transactionId.toString();

      return {
        success: true,
        tokenId: contractId, // Using tokenId field for contract ID
        transactionId,
        explorerUrl: this.getExplorerUrl(contractId, 'contract'),
        details: {
          contractId,
          evmAddress: `0x${ContractId.fromString(contractId).toSolidityAddress()}`,
          gas: options.gas,
          initialBalance: options.initialBalance || 0,
          network: this.network,
          transactionUrl: this.getExplorerUrl(transactionId, 'transaction')
        }
      };
    } catch (error: any) {
      logger.error('Smart contract deployment failed:', error);
      return failure('Smart contract deployment', error, { gas: options.gas });
    }
  }

  /**
   * Execute a state-changing contract function, with its arguments ABI-encoded
   */
  async callSmartContract(options: ContractCallOptions): Promise<TokenOperationResult> {
    assertValidInput('contract call', [
      InputSanitizer.validateEntityIdFormat(options.contractId, 'contract ID'),
      validateSolidityName(options.functionName),
      InputSanitizer.validateGasLimit(options.gas),
      InputSanitizer.validateOptionalAmount(options.payableAmount, 'Payable amount')
    ]);
    const parameters = buildContractParameters(options.parameters);
    const client = await this.requireClient();

    try {
      const transaction = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(options.contractId))
        .setGas(options.gas)
        .setFunction(options.functionName, parameters)
        .setMaxTransactionFee(new Hbar(2));
      if (options.payableAmount && options.payableAmount > 0) {
        transaction.setPayableAmount(Hbar.fromTinybars(options.payableAmount));
      }

      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);
      if (receipt.status !== Status.Success) {
        throw new Error(`Contract call receipt status ${receipt.status.toString()}`);
      }
      const transactionId = response.transactionId.toString();

      return {
        success: true,
        transactionId,
        explorerUrl: this.getExplorerUrl(transactionId, 'transaction'),
        details: {
          contractId: options.contractId,
          functionName: options.functionName,
          gas: options.gas,
          payableAmount: options.payableAmount || 0,
          network: this.network,
          receiptStatus: receipt.status.toString()
        }
      };
    } catch (error: any) {
      logger.error('Smart contract call failed:', error);
      return failure('Smart contract call', error, { contractId: options.contractId, functionName: options.functionName });
    }
  }

  /**
   * Read a view function (ContractCallQuery) and decode its single return
   * value. Throws on failure: there is no partial result.
   */
  async queryContract(options: ContractQueryOptions): Promise<ContractQueryResult> {
    const gas = options.gas ?? 100000;
    assertValidInput('contract query', [
      InputSanitizer.validateEntityIdFormat(options.contractId, 'contract ID'),
      validateSolidityName(options.functionName),
      InputSanitizer.validateGasLimit(gas),
      ['string', 'bool', 'uint256', 'address'].includes(options.returns)
        ? { valid: true }
        : { valid: false, error: `Unsupported return type "${options.returns}"; use string, bool, uint256 or address` }
    ]);
    const parameters = buildContractParameters(options.parameters);
    const client = await this.requireClient();

    const result = await new ContractCallQuery()
      .setContractId(ContractId.fromString(options.contractId))
      .setGas(gas)
      .setFunction(options.functionName, parameters)
      .execute(client);

    let value: string | boolean;
    switch (options.returns) {
      case 'string': value = result.getString(0); break;
      case 'bool': value = result.getBool(0); break;
      case 'uint256': value = result.getUint256(0).toString(10); break;
      case 'address': value = `0x${result.getAddress(0)}`; break;
    }

    return {
      success: true,
      value,
      details: {
        contractId: options.contractId,
        functionName: options.functionName,
        gasUsed: result.gasUsed?.toString() ?? '',
        network: this.network
      }
    };
  }

  /**
   * Create a Hedera Consensus Service (HCS) topic
   */
  async createTopic(options: TopicOptions = {}): Promise<TokenOperationResult> {
    const client = await this.requireClient();

    try {
      const transaction = new TopicCreateTransaction().setMaxTransactionFee(new Hbar(2));
      if (options.memo) transaction.setTopicMemo(options.memo);
      if (options.adminKey) transaction.setAdminKey(this.requireOperatorKey().publicKey);
      if (options.submitKey) transaction.setSubmitKey(this.requireOperatorKey().publicKey);
      if (options.autoRenewPeriod) transaction.setAutoRenewPeriod(options.autoRenewPeriod);

      logger.info('Submitting topic creation transaction...');
      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);
      const topicId = requireReceiptId(receipt.topicId, 'topic ID').toString();
      const transactionId = response.transactionId.toString();

      return {
        success: true,
        tokenId: topicId, // Using tokenId field for topic ID
        transactionId,
        explorerUrl: this.getExplorerUrl(topicId, 'topic'),
        details: {
          topicId,
          memo: options.memo || '',
          adminKey: !!options.adminKey,
          submitKey: !!options.submitKey,
          network: this.network,
          transactionUrl: this.getExplorerUrl(transactionId, 'transaction')
        }
      };
    } catch (error: any) {
      logger.error('HCS topic creation failed:', error);
      return failure('HCS topic creation', error, { memo: options.memo });
    }
  }

  /**
   * Submit a message to an HCS topic
   */
  async submitTopicMessage(options: TopicMessageOptions): Promise<TokenOperationResult> {
    assertValidInput('topic message', [
      InputSanitizer.validateEntityIdFormat(options.topicId, 'topic ID'),
      InputSanitizer.validateTopicMessage(options.message)
    ]);
    const client = await this.requireClient();

    try {
      const response = await new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(options.topicId))
        .setMessage(options.message)
        .setMaxTransactionFee(new Hbar(2))
        .execute(client);
      const receipt = await response.getReceipt(client);
      const sequenceNumber = requireReceiptId(receipt.topicSequenceNumber, 'topic sequence number').toString();
      const transactionId = response.transactionId.toString();

      return {
        success: true,
        transactionId,
        explorerUrl: this.getExplorerUrl(transactionId, 'transaction'),
        details: {
          topicId: options.topicId,
          sequenceNumber,
          messageLength: options.message.length,
          network: this.network,
          receiptStatus: receipt.status.toString()
        }
      };
    } catch (error: any) {
      logger.error('HCS message submission failed:', error);
      return failure('HCS message submission', error, { topicId: options.topicId });
    }
  }

  private requireOperatorKey(): PrivateKey {
    if (!this.operatorKey) {
      throw new Error('No operator key configured; call initialize() first');
    }
    return this.operatorKey;
  }

  /**
   * HashScan page for an entity or transaction. Transaction IDs use the
   * 0.0.x-seconds-nanos form HashScan accepts in URLs.
   */
  getExplorerUrl(id: string, page: ExplorerPage): string {
    const path = page === 'transaction' && id.includes('@')
      ? id.replace('@', '-').replace(/\.(\d+)$/, '-$1')
      : id;
    return `https://hashscan.io/${this.network}/${page}/${path}`;
  }

  /** hedera-agent-kit is not initialised, so never fully enabled */
  isFullyEnabled(): boolean {
    return false;
  }

  /** Always false: every operation uses the Hedera SDK directly */
  isUsingAgentKit(): boolean {
    return false;
  }

  getCapabilities(): { agentKit: boolean; directSDK: boolean } {
    return { agentKit: false, directSDK: this.client !== null };
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
    return this.client?.operatorAccountId?.toString() || null;
  }

  /**
   * Close client connections
   */
  close(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    this.operatorKey = null;
    this.initialized = false;
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

export async function mintToken(options: TokenMintOptions): Promise<TokenOperationResult> {
  return await hederaOperations.mintToken(options);
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

export async function queryContract(options: ContractQueryOptions): Promise<ContractQueryResult> {
  return await hederaOperations.queryContract(options);
}

export async function createTopic(options: TopicOptions = {}): Promise<TokenOperationResult> {
  return await hederaOperations.createTopic(options);
}

export async function submitTopicMessage(options: TopicMessageOptions): Promise<TokenOperationResult> {
  return await hederaOperations.submitTopicMessage(options);
}
