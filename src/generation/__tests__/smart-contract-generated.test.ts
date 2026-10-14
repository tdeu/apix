// src/generation/__tests__/smart-contract-generated.test.ts
//
// Runs the module `apix add smart-contract` generates (transpiled, with the real
// @hiero-ledger/sdk and a stub server-only): no fake deploy, validated bytecode.
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

describe('generated smart-contract-operations', () => {
  let root: string;
  let source: string;
  let mod: {
    validateBytecode(bytecode: unknown): string;
    smartContractManager: Record<string, unknown> & { deployContract(params: unknown): Promise<unknown> };
  };
  const savedEnv = { id: process.env.HEDERA_ACCOUNT_ID, key: process.env.HEDERA_PRIVATE_KEY };

  beforeAll(async () => {
    delete process.env.HEDERA_ACCOUNT_ID;
    delete process.env.HEDERA_PRIVATE_KEY;

    root = await fs.mkdtemp(path.join(os.tmpdir(), 'apix-contract-'));
    await fs.writeJSON(path.join(root, 'package.json'), { name: 'app', version: '1.0.0', dependencies: { next: '16.3.6' } });
    await fs.outputFile(path.join(root, 'src/app/page.tsx'), 'export default function Page() { return null; }\n');
    const install = jest.spyOn(PackageManager.prototype, 'installDependencies').mockResolvedValue();
    const context = nextContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan('smart-contract', {}, context);
    const generator = new IntegrationGenerator();
    await generator.initialize();
    await generator.generateIntegration(plan, context);
    install.mockRestore();

    await fs.ensureDir(path.join(root, 'node_modules'));
    await fs.symlink(path.join(REPO_ROOT, 'node_modules', '@hiero-ledger'), path.join(root, 'node_modules', '@hiero-ledger'), 'junction');
    await fs.outputFile(path.join(root, 'node_modules', 'server-only', 'index.js'), '');

    for (const file of ['client', 'smart-contract-operations']) {
      const ts_ = await fs.readFile(path.join(root, `src/lib/hedera/${file}.ts`), 'utf8');
      if (file === 'smart-contract-operations') source = ts_;
      const { outputText } = ts.transpileModule(ts_, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      });
      await fs.writeFile(path.join(root, `src/lib/hedera/${file}.js`), outputText);
    }
    mod = jest.requireActual(path.join(root, 'src/lib/hedera/smart-contract-operations.js'));
  }, 120_000);

  afterAll(async () => {
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    };
    restore('HEDERA_ACCOUNT_ID', savedEnv.id);
    restore('HEDERA_PRIVATE_KEY', savedEnv.key);
    await fs.remove(root);
  });

  it('ships no fake deploy and no hard-coded bytecode', () => {
    expect(source).not.toMatch(/deployERC20Token|0x6080|placeholder/i);
    expect(mod.smartContractManager.deployERC20Token).toBeUndefined();
  });

  it.each([
    ['no 0x prefix', '6080', /starting with "0x"/],
    ['not a string', 42, /starting with "0x"/],
    ['empty', '0x', /cannot be empty/],
    ['non-hex', '0x60zz', /valid hexadecimal/],
    ['odd length', '0x608', /even number of hex characters/],
  ])('rejects bytecode with %s', (_name, bytecode, expected) => {
    expect(() => mod.validateBytecode(bytecode)).toThrow(expected);
  });

  it('strips the 0x prefix from valid bytecode', () => {
    expect(mod.validateBytecode('0x6080AbCd')).toBe('6080AbCd');
  });

  it('validates bytecode before touching Hedera, then needs credentials', async () => {
    await expect(mod.smartContractManager.deployContract({ bytecode: 'nope' })).rejects.toThrow(/starting with "0x"/);
    await expect(mod.smartContractManager.deployContract({ bytecode: '0x6080' }))
      .rejects.toThrow(/HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set/);
  });
});
