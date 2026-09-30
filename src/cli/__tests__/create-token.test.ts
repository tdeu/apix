// `apix create-token` prints the real IDs, and never succeeds without them

jest.mock('inquirer', () => ({ __esModule: true, default: { prompt: jest.fn() } }));
jest.mock('../../services/hedera-operations', () => ({
  hederaOperations: {
    initialize: jest.fn(),
    getNetwork: () => 'testnet',
    getCurrentAccountId: () => '0.0.1234',
    createToken: jest.fn(),
    getExplorerUrl: (id: string, page: string) =>
      `https://hashscan.io/testnet/${page}/${page === 'transaction' ? id.replace('@', '-').replace(/\.(\d+)$/, '-$1') : id}`,
  },
}));

import { hederaOperations } from '../../services/hedera-operations';
import { APIxCLI, formatTokenAmount } from '../cli-core';

const createToken = hederaOperations.createToken as jest.Mock;
const options = { name: 'Proof', symbol: 'PRF', decimals: 2, initialSupply: 100000, adminKey: true, supplyKey: true };

describe('apix create-token', () => {
  let output: string[];
  let spies: jest.SpyInstance[];

  beforeEach(() => {
    output = [];
    const capture = (...args: unknown[]) => { output.push(args.map(String).join(' ')); };
    spies = [
      ...(['log', 'error', 'warn'] as const).map(m => jest.spyOn(console, m).mockImplementation(capture)),
      jest.spyOn(process.stdout, 'write').mockImplementation(() => true),
      jest.spyOn(process.stderr, 'write').mockImplementation(() => true),
    ];
  });

  afterEach(() => {
    spies.forEach(spy => spy.mockRestore());
    jest.clearAllMocks();
  });

  it('prints the token ID, transaction ID and HashScan links from the receipt', async () => {
    createToken.mockResolvedValue({ success: true, tokenId: '0.0.999', transactionId: '0.0.1234@1700000000.000000001' });
    await new APIxCLI().createTokenOnBlockchain(options);

    const all = output.join('\n');
    expect(createToken).toHaveBeenCalledWith(options);
    expect(all).toContain('100,000 smallest units (1,000.00 tokens)');
    expect(all).toContain('Supply Type: INFINITE');
    expect(all).toContain('Keys (operator key): admin, supply');
    expect(all).toContain('Token ID: 0.0.999');
    expect(all).toContain('Transaction ID: 0.0.1234@1700000000.000000001');
    expect(all).toContain('https://hashscan.io/testnet/token/0.0.999');
    expect(all).toContain('https://hashscan.io/testnet/transaction/0.0.1234-1700000000-000000001');
    expect(all).not.toContain('undefined');
  });

  it('fails when the result has no token ID', async () => {
    createToken.mockResolvedValue({ success: true, transactionId: '0.0.1234@1700000000.000000001' });
    await expect(new APIxCLI().createTokenOnBlockchain(options)).rejects.toThrow(/without a token ID/);
    expect(output.join('\n')).not.toContain('Token created successfully');
  });

  it('fails with the network error', async () => {
    createToken.mockResolvedValue({ success: false, error: 'Token creation failed: INSUFFICIENT_PAYER_BALANCE' });
    await expect(new APIxCLI().createTokenOnBlockchain(options)).rejects.toThrow(/INSUFFICIENT_PAYER_BALANCE/);
  });

  it('formats smallest units as token amounts', () => {
    expect(formatTokenAmount(100000, 2)).toBe('1,000.00');
    expect(formatTokenAmount(1000000, 8)).toBe('0.01000000');
    expect(formatTokenAmount(5, 0)).toBe('5');
  });
});
