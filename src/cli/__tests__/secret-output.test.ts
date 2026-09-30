// Errors that carry a secret never reach stdout/stderr in full

const HEDERA_KEY = '302e020100300506032b6570042204201111222233334444555566667777888899990000aaaabbbbccccdddd';
const ANTHROPIC_KEY = 'sk-ant-api03-AAAABBBBCCCCDDDDEEEE';
const OPENAI_KEY = 'sk-proj-FFFFGGGGHHHHIIIIJJJJ';
const SECRETS = { HEDERA_PRIVATE_KEY: HEDERA_KEY, ANTHROPIC_API_KEY: ANTHROPIC_KEY, OPENAI_API_KEY: OPENAI_KEY };
const LEAKY = `request failed for key ${HEDERA_KEY} (anthropic ${ANTHROPIC_KEY}, openai ${OPENAI_KEY})`;

// inquirer is ESM-only (Jest can't load it); none of these paths prompt
jest.mock('inquirer', () => ({ __esModule: true, default: { prompt: jest.fn() } }));

jest.mock('../../services/hedera-operations', () => ({
  hederaOperations: {
    initialize: jest.fn(),
    getNetwork: () => 'testnet',
    getCurrentAccountId: () => '0.0.1234',
    createToken: jest.fn(),
  },
}));

import { hederaOperations } from '../../services/hedera-operations';
import { APIxCLI } from '../cli-core';

describe('CLI error output masks secrets', () => {
  const saved: Record<string, string | undefined> = {};
  let output: string[];
  let spies: jest.SpyInstance[];

  beforeEach(() => {
    for (const [name, value] of Object.entries(SECRETS)) {
      saved[name] = process.env[name];
      process.env[name] = value;
    }
    output = [];
    const text = (a: unknown) => (typeof a === 'string' ? a : a instanceof Error ? `${a.message}\n${a.stack}` : JSON.stringify(a) ?? String(a));
    const capture = (...args: unknown[]) => { output.push(args.map(text).join(' ')); };
    const captureWrite = (chunk: unknown) => { output.push(String(chunk)); return true; };
    spies = [
      ...(['log', 'warn', 'error', 'info'] as const).map(m => jest.spyOn(console, m).mockImplementation(capture)),
      jest.spyOn(process.stdout, 'write').mockImplementation(captureWrite as any),
      jest.spyOn(process.stderr, 'write').mockImplementation(captureWrite as any),
    ];
  });

  afterEach(() => {
    spies.forEach(spy => spy.mockRestore());
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    jest.clearAllMocks();
  });

  function expectNoSecretInFull(): void {
    const all = output.join('\n');
    expect(all).toContain('request failed for key'); // the error itself was shown
    for (const value of Object.values(SECRETS)) {
      expect(all).not.toContain(value);
    }
    expect(all).toContain(`${HEDERA_KEY.slice(0, 6)}…`);
    expect(all).toContain('sk-ant…');
    expect(all).toContain('sk-pro…');
  }

  it('create-token failure', async () => {
    (hederaOperations.initialize as jest.Mock).mockRejectedValue(new Error(LEAKY));
    await expect(new APIxCLI().createTokenOnBlockchain({ name: 'T', symbol: 'T' } as any)).rejects.toThrow();
    expectNoSecretInFull();
  });

  it('validate failure', async () => {
    (hederaOperations.initialize as jest.Mock).mockRejectedValue(new Error(LEAKY));
    await expect(new APIxCLI().comprehensiveValidation({})).rejects.toThrow();
    expectNoSecretInFull();
  });

  it('analyze failure', async () => {
    const cli = new APIxCLI();
    (cli as any).analyzer.analyzeProject = jest.fn().mockRejectedValue(new Error(LEAKY));
    await expect(cli.analyze({ directory: '.' } as any)).rejects.toThrow();
    expectNoSecretInFull();
  });
});
