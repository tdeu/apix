// src/generation/__tests__/overwrite-protection.test.ts
import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { FileConflictError, IntegrationGenerator } from '../integration-generator';
import { IntegrationPlanner } from '../../planning/integration-planner';
import { PackageManager } from '../../utils/package-manager';
import { ProjectContext } from '../../types';

jest.mock('../../utils/logger');

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

async function treeSnapshot(root: string): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  const walk = async (dir: string) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (entry.isDirectory()) {
        snapshot[`${rel}/`] = 'dir';
        await walk(full);
      } else {
        snapshot[rel] = crypto.createHash('sha256').update(await fs.readFile(full)).digest('hex');
      }
    }
  };
  await walk(root);
  return snapshot;
}

describe('overwrite protection', () => {
  let root: string;
  let generator: IntegrationGenerator;

  const add = async (integration: string, force = false) => {
    const context = nextContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan(integration, { name: 'MyToken', symbol: 'MTK' }, context);
    return generator.generateIntegration(plan, context, { force });
  };

  beforeAll(async () => {
    generator = new IntegrationGenerator();
    await generator.initialize();
  });

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'apix-overwrite-'));
    await fs.writeJSON(path.join(root, 'package.json'), { name: 'app', version: '1.0.0', dependencies: { next: '16.3.6' } });
    await fs.outputFile(path.join(root, 'src/app/page.tsx'), 'export default function Page() { return null; }\n');
    jest.spyOn(PackageManager.prototype, 'installDependencies').mockResolvedValue();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.remove(root);
  });

  it('refuses to overwrite a different existing file and writes nothing', async () => {
    await fs.outputFile(path.join(root, 'src/lib/hedera/client.ts'), '// my own client\n');
    const before = await treeSnapshot(root);

    const attempt = add('smart-contract');
    await expect(attempt).rejects.toBeInstanceOf(FileConflictError);
    await expect(add('smart-contract')).rejects.toThrow(
      'These files already exist and differ from what APIX would generate:\n  - src/lib/hedera/client.ts\n' +
      'Nothing was written. Re-run with --force to overwrite them.'
    );

    // package.json (dependencies) included: nothing at all changed
    expect(await treeSnapshot(root)).toEqual(before);
  });

  it('overwrites only the conflicting files with force, and reports them', async () => {
    await fs.outputFile(path.join(root, 'src/lib/hedera/client.ts'), '// my own client\n');

    const result = await add('smart-contract', true);

    expect(result.overwrittenFiles).toEqual(['src/lib/hedera/client.ts']);
    expect(result.generatedFiles.map(f => f.path).sort())
      .toEqual(['src/lib/hedera/client.ts', 'src/lib/hedera/smart-contract-operations.ts']);
    expect(await fs.readFile(path.join(root, 'src/lib/hedera/client.ts'), 'utf8')).not.toContain('my own client');
  });

  it('leaves identical files alone, so integrations can share modules', async () => {
    await add('hts');
    const clientBefore = (await fs.stat(path.join(root, 'src/lib/hedera/client.ts'))).mtimeMs;

    // wallet regenerates hooks/useWallet.ts; consensus regenerates lib/hedera/client.ts
    const wallet = await add('wallet');
    const consensus = await add('consensus');

    expect(wallet.unchangedFiles).toEqual(['src/hooks/useWallet.ts']);
    expect(consensus.unchangedFiles).toEqual(['src/lib/hedera/client.ts']);
    expect(wallet.overwrittenFiles).toEqual([]);
    expect(consensus.overwrittenFiles).toEqual([]);
    expect((await fs.stat(path.join(root, 'src/lib/hedera/client.ts'))).mtimeMs).toBe(clientBefore);
  });

  it('running the same add twice changes nothing the second time', async () => {
    await add('hts');
    const before = await treeSnapshot(root);

    const again = await add('hts');

    expect(again.generatedFiles).toEqual([]);
    expect(again.overwrittenFiles).toEqual([]);
    expect(await treeSnapshot(root)).toEqual(before);
  });
});
