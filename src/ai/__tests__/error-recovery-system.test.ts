import fs from 'fs';
import path from 'path';
import { ErrorRecoverySystem, NOT_RETRIED, OperationContext } from '../recovery/error-recovery-system';
import { AIClient } from '../provider';
import { AIRequestError, AIUnavailableError } from '../errors';

const operation: OperationContext = {
  type: 'template-generation',
  parameters: { integration: 'hts' },
  originalRequirement: 'create a token',
  projectContext: {},
};

const classification = {
  category: 'configuration',
  severity: 'medium',
  recoverability: 'manual-recovery',
  rootCause: { immediate: 'missing env var', underlying: 'setup', contributing: [] },
  impact: { components: ['cli'], userImpact: 'blocked', businessImpact: 'none', dataIntegrity: 'safe' },
  confidence: 0.8,
  recoverySuggestions: ['Set HEDERA_ACCOUNT_ID'],
};
const strategies = {
  primaryStrategies: [{ approach: 'configuration-update', priority: 1, successProbability: 0.9, description: 'Add the variable' }],
  fallbackStrategies: [{ approach: 'guided-troubleshooting', priority: 2, successProbability: 0.5 }],
};

function fakeClient(...answers: Array<string | Error>): AIClient & { complete: jest.Mock } {
  const complete = jest.fn();
  for (const answer of answers) {
    if (answer instanceof Error) complete.mockRejectedValueOnce(answer);
    else complete.mockResolvedValueOnce(answer);
  }
  return { provider: 'anthropic', model: 'claude-sonnet-5', complete };
}

describe('ErrorRecoverySystem (diagnosis only)', () => {
  it('diagnoses without retrying, and never reports success', async () => {
    const client = fakeClient(JSON.stringify(classification), JSON.stringify(strategies));
    const system = new ErrorRecoverySystem({ client });

    const result = await system.detectAndRecover(operation, new Error('HEDERA_ACCOUNT_ID missing'));

    expect(result.success).toBe(false);
    expect(result.strategy).toBe('diagnosis-only');
    expect(result.message).toBe(NOT_RETRIED);
    expect(result.attempts).toEqual([]);
    expect(result.recommendations).toEqual([
      'Set HEDERA_ACCOUNT_ID',
      'configuration-update: Add the variable',
      'guided-troubleshooting',
    ]);
    // One classification call and one strategy call: nothing re-run
    expect(client.complete).toHaveBeenCalledTimes(2);
  });

  it('orders suggested strategies by priority', async () => {
    const reversed = { primaryStrategies: [{ approach: 'b', priority: 3 }], fallbackStrategies: [{ approach: 'a', priority: 1 }] };
    const system = new ErrorRecoverySystem({ client: fakeClient(JSON.stringify(classification), JSON.stringify(reversed)) });
    const diagnosis = await system.diagnose(new Error('x'), operation);
    expect(diagnosis.suggestedStrategies.map(s => s.approach)).toEqual(['a', 'b']);
  });

  it('surfaces AI failures instead of inventing a diagnosis', async () => {
    const failure = new AIRequestError('anthropic', 'Anthropic request failed (500): boom', 500);
    const client = fakeClient(failure);
    const system = new ErrorRecoverySystem({ client });
    await expect(system.detectAndRecover(operation, new Error('x'))).rejects.toBe(failure);
    expect(client.complete).toHaveBeenCalledTimes(1);
  });

  it('rejects an unparseable classification', async () => {
    const system = new ErrorRecoverySystem({ client: fakeClient('I think it is a config problem') });
    await expect(system.diagnose(new Error('x'), operation)).rejects.toThrow(/isn't valid JSON/);
  });

  it('needs an AI key', async () => {
    const saved = { a: process.env.ANTHROPIC_API_KEY, o: process.env.OPENAI_API_KEY };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const system = new ErrorRecoverySystem({ command: 'debug' });
      await expect(system.diagnose(new Error('x'), operation)).rejects.toBeInstanceOf(AIUnavailableError);
    } finally {
      if (saved.a !== undefined) process.env.ANTHROPIC_API_KEY = saved.a;
      if (saved.o !== undefined) process.env.OPENAI_API_KEY = saved.o;
    }
  });
});

describe('no randomness in AI and services code', () => {
  function sources(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(full);
      return entry.name.endsWith('.ts') ? [full] : [];
    });
  }

  it('has no Math.random in src/ai or src/services', () => {
    const root = path.join(__dirname, '..', '..');
    const offenders = ['ai', 'services']
      .map(dir => path.join(root, dir))
      .filter(dir => fs.existsSync(dir))
      .flatMap(sources)
      .filter(file => fs.readFileSync(file, 'utf8').includes('Math.random'));
    expect(offenders).toEqual([]);
  });
});
