// src/generation/__tests__/consensus-generated.test.ts
//
// Runs the consensus module `apix add consensus` generates (transpiled, with the
// real @hashgraph/sdk and a stub server-only) to check its input validation and
// that it needs no credentials until it is actually used.
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import ts from 'typescript';
import { IntegrationGenerator } from '../integration-generator';
import { IntegrationPlanner } from '../../planning/integration-planner';
import { PackageManager } from '../../utils/package-manager';
import { ProjectContext } from '../../types';

jest.mock('../../utils/logger');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function nextContext(rootPath: string): ProjectContext {
  return {
    framework: 'next.js',
    language: 'typescript',
    packageManager: 'npm',
    rootPath,
    dependencies: [],
    devDependencies: [],
    scripts: {},
    hasExistingAuth: false,
    hasStateManagement: null,
    hasUILibrary: null,
    projectStructure: {
      hasApiRoutes: false, hasPages: false, hasComponents: false, hasHooks: false,
      hasContexts: false, hasUtils: false, hasStyles: false, directories: [], configFiles: []
    },
    existingIntegrations: []
  };
}

describe('generated consensus-operations', () => {
  let root: string;
  let mod: any;
  const savedEnv = { id: process.env.HEDERA_ACCOUNT_ID, key: process.env.HEDERA_PRIVATE_KEY };

  beforeAll(async () => {
    delete process.env.HEDERA_ACCOUNT_ID;
    delete process.env.HEDERA_PRIVATE_KEY;

    root = await fs.mkdtemp(path.join(os.tmpdir(), 'apix-consensus-'));
    await fs.writeJSON(path.join(root, 'package.json'), { name: 'app', version: '1.0.0', dependencies: { next: '16.3.6' } });
    await fs.outputFile(path.join(root, 'src/app/page.tsx'), 'export default function Page() { return null; }\n');
    const install = jest.spyOn(PackageManager.prototype, 'installDependencies').mockResolvedValue();
    const context = nextContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan('consensus', {}, context);
    const generator = new IntegrationGenerator();
    await generator.initialize();
    await generator.generateIntegration(plan, context);
    install.mockRestore();

    // Runtime deps: the real SDK (junction, no admin rights needed) and a no-op server-only
    await fs.ensureDir(path.join(root, 'node_modules'));
    await fs.symlink(path.join(REPO_ROOT, 'node_modules', '@hashgraph'), path.join(root, 'node_modules', '@hashgraph'), 'junction');
    await fs.outputFile(path.join(root, 'node_modules', 'server-only', 'index.js'), '');

    for (const file of ['client', 'consensus-operations']) {
      const source = await fs.readFile(path.join(root, `src/lib/hedera/${file}.ts`), 'utf8');
      const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      });
      await fs.writeFile(path.join(root, `src/lib/hedera/${file}.js`), outputText);
    }

    // Importing must not need credentials
    mod = require(path.join(root, 'src/lib/hedera/consensus-operations.js'));
  }, 120_000);

  afterAll(async () => {
    if (savedEnv.id !== undefined) process.env.HEDERA_ACCOUNT_ID = savedEnv.id;
    if (savedEnv.key !== undefined) process.env.HEDERA_PRIVATE_KEY = savedEnv.key;
    await fs.remove(root);
  });

  it.each([
    ['a malformed topic ID', { topicId: 'topic-1', message: 'hi' }, /Invalid topic ID/],
    ['an empty message', { topicId: '0.0.5', message: '' }, /Message is required/],
    ['a non-string message', { topicId: '0.0.5', message: 42 }, /Message is required/],
    ['a message over 1024 bytes', { topicId: '0.0.5', message: 'x'.repeat(1025) }, /exceeds 1024 bytes \(got 1025\)/],
    // 342 characters but 1026 bytes: the limit is in bytes
    ['a multi-byte message over 1024 bytes', { topicId: '0.0.5', message: '€'.repeat(342) }, /exceeds 1024 bytes \(got 1026\)/],
  ])('rejects %s before touching Hedera', async (_name, params, expected) => {
    await expect(mod.consensusManager.submitMessage(params)).rejects.toThrow(expected);
    await expect(mod.consensusManager.submitMessage(params)).rejects.toBeInstanceOf(mod.ConsensusInputError);
  });

  it('rejects a memo over 100 bytes', async () => {
    await expect(mod.consensusManager.createTopic({ memo: 'm'.repeat(101) })).rejects.toThrow(/Memo exceeds 100 bytes/);
  });

  it('accepts a message of exactly 1024 bytes, then needs credentials to send it', async () => {
    await expect(mod.consensusManager.submitMessage({ topicId: '0.0.5', message: 'x'.repeat(1024) }))
      .rejects.toThrow(/HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set/);
  });
});
