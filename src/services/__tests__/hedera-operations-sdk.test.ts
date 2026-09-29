// What hedera-operations sends and when it may report success. No network:
// each transaction's execute() is replaced by a fake that captures the
// transaction APIX built and returns a chosen receipt.
import {
  ContractCallQuery, ContractCreateFlow, ContractExecuteTransaction, PrivateKey, Status, TokenCreateTransaction,
  TokenMintTransaction, TokenSupplyType, TopicCreateTransaction, TopicMessageSubmitTransaction, TransactionId,
  TransferTransaction, TokenId, TopicId, ContractId
} from '@hashgraph/sdk';
import { HederaOperationsService, buildContractParameters } from '../hedera-operations';

jest.mock('../hedera-agent-kit-service', () => ({ HederaAgentKitService: jest.fn() }));
jest.mock('../../utils/logger');

const OPERATOR = '0.0.1234';
const operatorKey = PrivateKey.generateED25519();
const TX = '0.0.1234@1700000000.000000001';

/** Replace execute() on a transaction class; returns what it was called on */
function fakeExecute(proto: any, receipt: Record<string, unknown>): { built: () => any } {
  let built: any;
  jest.spyOn(proto, 'execute').mockImplementation(async function (this: any) {
    built = this;
    return { transactionId: TransactionId.fromString(TX), getReceipt: async () => ({ status: Status.Success, ...receipt }) };
  });
  return { built: () => built };
}

const hex = (bytes: Uint8Array | null) => Buffer.from(bytes ?? []).toString('hex');
const word = (h: string) => h.padStart(64, '0');

describe('hedera-operations (SDK path)', () => {
  let service: HederaOperationsService;

  beforeEach(async () => {
    process.env.HEDERA_ACCOUNT_ID = OPERATOR;
    process.env.HEDERA_PRIVATE_KEY = operatorKey.toStringDer();
    service = new HederaOperationsService('testnet');
    await service.initialize();
  });

  afterEach(() => {
    service.close();
    jest.restoreAllMocks();
    delete process.env.HEDERA_ACCOUNT_ID;
    delete process.env.HEDERA_PRIVATE_KEY;
  });

  describe('createToken', () => {
    it('creates an INFINITE token with no keys by default, in smallest units', async () => {
      const tx = fakeExecute(TokenCreateTransaction.prototype, { tokenId: TokenId.fromString('0.0.999') });
      const result = await service.createToken({ name: 'Proof', symbol: 'PRF', decimals: 2, initialSupply: 100000 });

      expect(result).toMatchObject({
        success: true,
        tokenId: '0.0.999',
        transactionId: TX,
        explorerUrl: 'https://hashscan.io/testnet/token/0.0.999',
      });
      expect(result.details.method).toBe('Hedera SDK');
      const built = tx.built() as TokenCreateTransaction;
      expect(built.tokenName).toBe('Proof');
      expect(built.decimals?.toNumber()).toBe(2);
      expect(built.initialSupply?.toNumber()).toBe(100000);
      expect(built.supplyType).toBe(TokenSupplyType.Infinite);
      expect(built.treasuryAccountId?.toString()).toBe(OPERATOR);
      expect(built.adminKey).toBeNull();
      expect(built.supplyKey).toBeNull();
    });

    it('caps the supply and sets operator keys when asked', async () => {
      const tx = fakeExecute(TokenCreateTransaction.prototype, { tokenId: TokenId.fromString('0.0.999') });
      await service.createToken({ name: 'Proof', symbol: 'PRF', initialSupply: 10, maxSupply: 1000, adminKey: true, supplyKey: true });

      const built = tx.built() as TokenCreateTransaction;
      expect(built.supplyType).toBe(TokenSupplyType.Finite);
      expect(built.maxSupply?.toNumber()).toBe(1000);
      expect(built.adminKey?.toString()).toBe(operatorKey.publicKey.toString());
      expect(built.supplyKey?.toString()).toBe(operatorKey.publicKey.toString());
      expect(built.freezeKey).toBeNull();
    });

    it('rejects a max supply below the initial supply, or a foreign treasury, before sending', async () => {
      const execute = jest.spyOn(TokenCreateTransaction.prototype, 'execute');
      await expect(service.createToken({ name: 'Proof', symbol: 'PRF', initialSupply: 10, maxSupply: 5 }))
        .rejects.toThrow(/Initial supply cannot exceed max supply/);
      await expect(service.createToken({ name: 'Proof', symbol: 'PRF', treasuryAccount: '0.0.42' }))
        .rejects.toThrow(/treasury must be the operator account/);
      expect(execute).not.toHaveBeenCalled();
    });

    it('never reports success without a token ID', async () => {
      fakeExecute(TokenCreateTransaction.prototype, { tokenId: null });
      const result = await service.createToken({ name: 'Proof', symbol: 'PRF' });
      expect(result.success).toBe(false);
      expect(result.tokenId).toBeUndefined();
      expect(result.error).toMatch(/no token ID/);
    });
  });

  describe('mintToken', () => {
    it('mints and reports the new total supply', async () => {
      const tx = fakeExecute(TokenMintTransaction.prototype, { totalSupply: { toString: () => '105000' } });
      const result = await service.mintToken({ tokenId: '0.0.999', amount: 5000 });

      expect(result).toMatchObject({ success: true, tokenId: '0.0.999', transactionId: TX });
      expect(result.details.totalSupply).toBe('105000');
      const built = tx.built() as TokenMintTransaction;
      expect(built.tokenId?.toString()).toBe('0.0.999');
      expect(built.amount?.toNumber()).toBe(5000);
    });

    it('fails without a total supply in the receipt, and on bad input', async () => {
      fakeExecute(TokenMintTransaction.prototype, { totalSupply: null });
      expect((await service.mintToken({ tokenId: '0.0.999', amount: 1 })).success).toBe(false);
      await expect(service.mintToken({ tokenId: '0.0.999', amount: 0 })).rejects.toThrow(/Amount must be greater than 0/);
    });
  });

  it('transferToken fails unless the receipt says SUCCESS', async () => {
    fakeExecute(TransferTransaction.prototype, { status: Status.InsufficientTokenBalance });
    const result = await service.transferToken({ tokenId: '0.0.999', fromAccount: OPERATOR, toAccount: '0.0.42', amount: 1 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/INSUFFICIENT_TOKEN_BALANCE/);
  });

  describe('topics', () => {
    it('createTopic needs a topic ID; its link is the topic page', async () => {
      fakeExecute(TopicCreateTransaction.prototype, { topicId: TopicId.fromString('0.0.77') });
      expect(await service.createTopic({ memo: 'm' })).toMatchObject({ success: true, tokenId: '0.0.77', explorerUrl: 'https://hashscan.io/testnet/topic/0.0.77' });

      jest.restoreAllMocks();
      fakeExecute(TopicCreateTransaction.prototype, { topicId: null });
      expect((await service.createTopic({ memo: 'm' })).success).toBe(false);
    });

    it('submitTopicMessage needs a sequence number', async () => {
      fakeExecute(TopicMessageSubmitTransaction.prototype, { topicSequenceNumber: { toString: () => '3' } });
      const ok = await service.submitTopicMessage({ topicId: '0.0.77', message: 'hi' });
      expect(ok.details.sequenceNumber).toBe('3');
      expect(ok.explorerUrl).toBe('https://hashscan.io/testnet/transaction/0.0.1234-1700000000-000000001');

      jest.restoreAllMocks();
      fakeExecute(TopicMessageSubmitTransaction.prototype, { topicSequenceNumber: null });
      expect((await service.submitTopicMessage({ topicId: '0.0.77', message: 'hi' })).success).toBe(false);
    });
  });

  describe('contracts', () => {
    it('deploys via ContractCreateFlow and needs a contract ID', async () => {
      const flow = fakeExecute(ContractCreateFlow.prototype, { contractId: ContractId.fromString('0.0.500') });
      const result = await service.deploySmartContract({ bytecode: '0x6080', gas: 400000 });
      expect(result).toMatchObject({ success: true, tokenId: '0.0.500', explorerUrl: 'https://hashscan.io/testnet/contract/0.0.500' });
      // The flow uploads the bytecode as hex text, the format Hedera's file service expects
      expect(Buffer.from((flow.built() as ContractCreateFlow).bytecode ?? []).toString()).toBe('6080');

      jest.restoreAllMocks();
      fakeExecute(ContractCreateFlow.prototype, { contractId: null });
      expect((await service.deploySmartContract({ bytecode: '6080', gas: 400000 })).success).toBe(false);
      await expect(service.deploySmartContract({ bytecode: '0xzz', gas: 400000 })).rejects.toThrow(/valid hexadecimal/);
    });

    it('encodes the function selector and a string argument', async () => {
      const tx = fakeExecute(ContractExecuteTransaction.prototype, {});
      const result = await service.callSmartContract({
        contractId: '0.0.500', functionName: 'set', gas: 100000,
        parameters: [{ type: 'string', value: 'hello from APIX' }],
      });
      expect(result.success).toBe(true);

      const text = Buffer.from('hello from APIX').toString('hex');
      expect(hex((tx.built() as ContractExecuteTransaction).functionParameters)).toBe(
        '4ed3885e' +                     // set(string), from solc
        word('20') +                     // offset of the string
        word((15).toString(16)) +        // its length
        text.padEnd(64, '0')             // its bytes, right-padded
      );
    });

    it('encodes uint256, bool, address, bytes32 and int256', () => {
      const bytes32 = '0x' + 'ab'.repeat(32);
      const encoded = buildContractParameters([
        { type: 'uint256', value: '115792089237316195423570985008687907853269984665640564039457584007913129639935' },
        { type: 'bool', value: true },
        { type: 'address', value: '0.0.1234' },
        { type: 'bytes32', value: bytes32 },
        { type: 'int256', value: -1 },
      ])._build('mix');
      expect(hex(encoded)).toBe(
        'db5da564' +                     // mix(uint256,bool,address,bytes32,int256), from solc
        'f'.repeat(64) +                 // 2^256 - 1
        word('1') +
        word('4d2') +                    // 0.0.1234 as an EVM address
        'ab'.repeat(32) +
        'f'.repeat(64)                   // -1 in two's complement
      );
    });

    it.each([
      ['a bad function name', { functionName: 'set(string)' }, /Invalid function name/],
      ['a negative uint256', { parameters: [{ type: 'uint256', value: -1 }] }, /out of range for uint256/],
      ['an unsafe number', { parameters: [{ type: 'uint256', value: 2 ** 60 }] }, /safe integer/],
      ['a non-boolean bool', { parameters: [{ type: 'bool', value: 'yes' }] }, /true or false/],
      ['a bad address', { parameters: [{ type: 'address', value: '0x1234' }] }, /EVM address/],
      ['a short bytes32', { parameters: [{ type: 'bytes32', value: '0x1234' }] }, /32 bytes/],
      ['an unknown type', { parameters: [{ type: 'tuple', value: [] }] }, /unsupported type/],
    ])('rejects %s before sending', async (_name, override, expected) => {
      const execute = jest.spyOn(ContractExecuteTransaction.prototype, 'execute');
      await expect(service.callSmartContract({ contractId: '0.0.500', functionName: 'set', gas: 100000, ...(override as any) }))
        .rejects.toThrow(expected);
      expect(execute).not.toHaveBeenCalled();
    });

    it('fails when the call reverts', async () => {
      jest.spyOn(ContractExecuteTransaction.prototype, 'execute').mockRejectedValue(new Error('CONTRACT_REVERT_EXECUTED'));
      const result = await service.callSmartContract({ contractId: '0.0.500', functionName: 'set', gas: 100000 });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/CONTRACT_REVERT_EXECUTED/);
    });

    it('queryContract encodes the call and decodes the return value', async () => {
      let built: ContractCallQuery | undefined;
      const fakeResult = {
        getString: () => 'hello from APIX',
        getBool: () => true,
        getUint256: () => ({ toString: (base: number) => (base === 10 ? '42' : '2a') }),
        getAddress: () => '00000000000000000000000000000000000004d2',
        gasUsed: { toString: () => '2500' },
      };
      jest.spyOn(ContractCallQuery.prototype, 'execute').mockImplementation(async function (this: any) {
        built = this;
        return fakeResult as any;
      });

      const read = await service.queryContract({ contractId: '0.0.500', functionName: 'get', returns: 'string' });
      expect(read.value).toBe('hello from APIX');
      expect(hex(built!.functionParameters)).toBe('6d4ce63c'); // get(), from solc
      expect((await service.queryContract({ contractId: '0.0.500', functionName: 'get', returns: 'uint256' })).value).toBe('42');
      expect((await service.queryContract({ contractId: '0.0.500', functionName: 'get', returns: 'bool' })).value).toBe(true);
      expect((await service.queryContract({ contractId: '0.0.500', functionName: 'get', returns: 'address' })).value)
        .toBe('0x00000000000000000000000000000000000004d2');
      await expect(service.queryContract({ contractId: '0.0.500', functionName: 'get', returns: 'bytes' as any }))
        .rejects.toThrow(/Unsupported return type/);
    });
  });

  it('builds HashScan links for every page type', () => {
    expect(service.getExplorerUrl('0.0.5', 'account')).toBe('https://hashscan.io/testnet/account/0.0.5');
    expect(service.getExplorerUrl('0.0.5', 'contract')).toBe('https://hashscan.io/testnet/contract/0.0.5');
    expect(service.getExplorerUrl('0.0.1234@1700000000.000000001', 'transaction'))
      .toBe('https://hashscan.io/testnet/transaction/0.0.1234-1700000000-000000001');
  });
});
