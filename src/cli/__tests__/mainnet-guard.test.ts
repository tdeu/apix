// Nothing is spent on mainnet without an explicit yes

jest.mock('inquirer', () => ({ __esModule: true, default: { prompt: jest.fn() } }));

let network = 'mainnet';
jest.mock('../../services/hedera-operations', () => ({
  hederaOperations: {
    initialize: jest.fn(),
    getNetwork: () => network,
    getCurrentAccountId: () => '0.0.1234',
    createToken: jest.fn().mockResolvedValue({ success: true, tokenId: '0.0.999', transactionId: '0.0.1234@1700000000.000000001' }),
    getExplorerUrl: (id: string, page: string) => `https://hashscan.io/${network}/${page}/${id}`,
  },
}));

import inquirer from 'inquirer';
import { hederaOperations } from '../../services/hedera-operations';
import { confirmMainnetSpend, MAINNET_PROMPT } from '../mainnet-guard';
import { APIxCLI } from '../cli-core';

describe('confirmMainnetSpend', () => {
  it('does not ask on testnet', async () => {
    const ask = jest.fn();
    await expect(confirmMainnetSpend('testnet', { interactive: false, ask })).resolves.toBeUndefined();
    expect(ask).not.toHaveBeenCalled();
  });

  it('does not ask on mainnet with --yes', async () => {
    const ask = jest.fn();
    await expect(confirmMainnetSpend('mainnet', { yes: true, interactive: false, ask })).resolves.toBeUndefined();
    expect(ask).not.toHaveBeenCalled();
  });

  it('refuses on mainnet with no terminal and no --yes', async () => {
    const ask = jest.fn();
    await expect(confirmMainnetSpend('mainnet', { interactive: false, ask })).rejects.toThrow(/re-run with --yes/);
    expect(ask).not.toHaveBeenCalled();
  });

  it('asks the exact question and stops on No', async () => {
    const ask = jest.fn().mockResolvedValue(false);
    await expect(confirmMainnetSpend('mainnet', { interactive: true, ask })).rejects.toThrow(/Cancelled: nothing was sent to mainnet/);
    expect(ask).toHaveBeenCalledWith('This will spend real HBAR on MAINNET. Continue?');
  });

  it('continues on Yes', async () => {
    await expect(confirmMainnetSpend('mainnet', { interactive: true, ask: async () => true })).resolves.toBeUndefined();
  });

  it('defaults to No in the inquirer prompt', async () => {
    (inquirer.prompt as unknown as jest.Mock).mockResolvedValue({ confirmed: false });
    await expect(confirmMainnetSpend('mainnet', { interactive: true })).rejects.toThrow(/Cancelled/);
    expect((inquirer.prompt as unknown as jest.Mock).mock.calls[0][0][0]).toMatchObject({ type: 'confirm', message: MAINNET_PROMPT, default: false });
  });
});

describe('commands that spend HBAR', () => {
  const savedTTY = process.stdin.isTTY;
  let spies: jest.SpyInstance[];

  beforeEach(() => {
    network = 'mainnet';
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    process.env.HEDERA_ACCOUNT_ID = '0.0.1234';
    process.env.HEDERA_PRIVATE_KEY = 'x'.repeat(64);
    spies = [
      ...(['log', 'error', 'warn'] as const).map(m => jest.spyOn(console, m).mockImplementation(() => undefined)),
      jest.spyOn(process.stdout, 'write').mockImplementation(() => true),
      jest.spyOn(process.stderr, 'write').mockImplementation(() => true),
    ];
  });

  afterEach(() => {
    spies.forEach(spy => spy.mockRestore());
    Object.defineProperty(process.stdin, 'isTTY', { value: savedTTY, configurable: true });
    delete process.env.HEDERA_ACCOUNT_ID;
    delete process.env.HEDERA_PRIVATE_KEY;
    jest.clearAllMocks();
  });

  it('create-token on mainnet without --yes refuses before touching the network', async () => {
    await expect(new APIxCLI().createTokenOnBlockchain({ name: 'Proof', symbol: 'PRF' })).rejects.toThrow(/--yes/);
    expect(hederaOperations.initialize).not.toHaveBeenCalled();
    expect(hederaOperations.createToken).not.toHaveBeenCalled();
  });

  it('create-token on mainnet with --yes goes ahead', async () => {
    await new APIxCLI().createTokenOnBlockchain({ name: 'Proof', symbol: 'PRF' }, { yes: true });
    expect(hederaOperations.createToken).toHaveBeenCalledTimes(1);
  });

  it('create-token on testnet needs no confirmation', async () => {
    network = 'testnet';
    await new APIxCLI().createTokenOnBlockchain({ name: 'Proof', symbol: 'PRF' });
    expect(hederaOperations.createToken).toHaveBeenCalledTimes(1);
  });

  it('add hts --create-token on mainnet without --yes refuses before analysing or writing anything', async () => {
    const cli = new APIxCLI();
    const analyzeProject = jest.fn();
    (cli as any).analyzer.analyzeProject = analyzeProject;
    await expect(cli.addIntegration('hts', { createToken: true })).rejects.toThrow(/--yes/);
    expect(analyzeProject).not.toHaveBeenCalled();
    expect(hederaOperations.createToken).not.toHaveBeenCalled();
  });
});
