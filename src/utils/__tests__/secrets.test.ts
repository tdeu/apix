import fs from 'fs';
import os from 'os';
import path from 'path';
import { maskSecrets, maskSecretsDeep, maskValue } from '../secrets';
import { logger, LogLevel } from '../logger';
import { DebugLogger } from '../debug-logger';

const env = {
  ANTHROPIC_API_KEY: 'sk-ant-api03-SECRETSECRETSECRET',
  OPENAI_API_KEY: 'sk-proj-SECRETSECRETSECRET',
  HEDERA_PRIVATE_KEY: '302e020100300506032b657004220420deadbeefdeadbeefdeadbeef',
  WALLETCONNECT_PROJECT_ID: 'a1b2c3d4e5f6a7b8c9d0',
};

describe('maskValue / maskSecrets', () => {
  it('keeps at most the first 6 characters', () => {
    expect(maskValue('sk-ant-api03-xyz')).toBe('sk-ant…');
    expect(maskValue('abc')).toBe('***');
  });

  it('masks every configured secret in text', () => {
    const text = `keys: ${env.ANTHROPIC_API_KEY} ${env.OPENAI_API_KEY} ${env.HEDERA_PRIVATE_KEY} ${env.WALLETCONNECT_PROJECT_ID}`;
    const masked = maskSecrets(text, env);
    for (const value of Object.values(env)) {
      expect(masked).not.toContain(value);
      expect(masked).toContain(value.slice(0, 6) + '…');
    }
  });

  it('leaves text alone when nothing is configured', () => {
    expect(maskSecrets('nothing to hide', {})).toBe('nothing to hide');
  });

  it('masks nested objects and errors, and survives cycles', () => {
    const cyclic: any = { key: env.OPENAI_API_KEY, list: [env.HEDERA_PRIVATE_KEY], err: new Error(`bad ${env.ANTHROPIC_API_KEY}`) };
    cyclic.self = cyclic;
    const masked = maskSecretsDeep(cyclic, env);
    const printed = JSON.stringify({ ...masked, self: undefined, err: masked.err.message });
    for (const value of [env.OPENAI_API_KEY, env.HEDERA_PRIVATE_KEY, env.ANTHROPIC_API_KEY]) {
      expect(printed).not.toContain(value);
    }
    expect(masked.self).toBe('[Circular]');
  });
});

describe('log output never prints a key in full', () => {
  const saved: Record<string, string | undefined> = {};
  let output: string[];
  let spies: jest.SpyInstance[];

  beforeEach(() => {
    for (const [name, value] of Object.entries(env)) {
      saved[name] = process.env[name];
      process.env[name] = value;
    }
    output = [];
    const capture = (...args: any[]) => { output.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a) ?? String(a))).join(' ')); };
    spies = (['log', 'warn', 'error'] as const).map(method => jest.spyOn(console, method).mockImplementation(capture));
  });

  afterEach(() => {
    spies.forEach(spy => spy.mockRestore());
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  function expectMasked(): void {
    const all = output.join('\n');
    expect(all.length).toBeGreaterThan(0);
    for (const value of Object.values(env)) {
      expect(all).not.toContain(value);
    }
  }

  it('masks the user-facing logger, including error details', () => {
    const previous = logger.getLevel();
    logger.setLevel(LogLevel.DEBUG);
    try {
      logger.error(`failed with ${env.ANTHROPIC_API_KEY}`, new Error(`401 ${env.OPENAI_API_KEY}`));
      logger.info('context', { walletConnect: env.WALLETCONNECT_PROJECT_ID });
      logger.debug('key', env.HEDERA_PRIVATE_KEY);
    } finally {
      logger.setLevel(previous);
    }
    expectMasked();
  });

  it('masks what `logs` and `last-error` read back, even from older log files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apix-secrets-'));
    const debug = new DebugLogger({ logDirectory: dir, enableConsole: false });
    try {
      for (let i = 0; i < 50 && !debug.getCurrentLogFile(); i++) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      const file = debug.getCurrentLogFile();
      expect(file).toBeTruthy();
      // A line written unmasked, as an older APIX version would have
      fs.appendFileSync(file!, JSON.stringify({
        timestamp: new Date().toISOString(), level: 0, message: `boom ${env.ANTHROPIC_API_KEY}`,
        error: { message: env.OPENAI_API_KEY, stack: `at ${env.HEDERA_PRIVATE_KEY}` },
      }) + '\n');

      const lastError = await debug.getLastError();
      const printed = JSON.stringify(lastError);
      expect(lastError?.message).toContain('boom sk-ant…');
      for (const value of Object.values(env)) {
        expect(printed).not.toContain(value);
      }
    } finally {
      await debug.cleanup();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('masks the debug logger console output', () => {
    const debug = new DebugLogger({ enableFileLogging: false, enableTrace: true });
    debug.error(`failed with ${env.ANTHROPIC_API_KEY}`, new Error(env.OPENAI_API_KEY), { key: env.HEDERA_PRIVATE_KEY });
    debug.warn('warn', { id: env.WALLETCONNECT_PROJECT_ID });
    expectMasked();
  });
});
