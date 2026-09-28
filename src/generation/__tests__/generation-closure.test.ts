// src/generation/__tests__/generation-closure.test.ts
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { IntegrationGenerator } from '../integration-generator';
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

// Modules that touch the operator key or the Hedera Client
const SERVER_ONLY = ['src/lib/hedera/client.ts', 'src/lib/hedera/hts-operations.ts', 'src/lib/hedera/smart-contract-operations.ts', 'src/lib/hedera/consensus-operations.ts'];

describe.each(['hts', 'smart-contract', 'consensus'])('`apix add %s` on a Next.js src/app project', integration => {
  let root: string;
  let files: string[];
  let dependencies: string[];

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), `apix-closure-${integration}-`));
    await fs.writeJSON(path.join(root, 'package.json'), { name: 'app', version: '1.0.0', dependencies: { next: '16.3.6' } });
    await fs.outputFile(path.join(root, 'src/app/page.tsx'), 'export default function Page() { return null; }\n');
    jest.spyOn(PackageManager.prototype, 'installDependencies').mockResolvedValue();

    const context = nextContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan(integration, { name: 'MyToken', symbol: 'MTK' }, context);
    const generator = new IntegrationGenerator();
    await generator.initialize();
    await generator.generateIntegration(plan, context);
    files = plan.templates.map(t => t.outputPath);
    dependencies = Object.keys((await fs.readJSON(path.join(root, 'package.json'))).dependencies);
  }, 120_000); // generation is slow when the whole suite runs in parallel

  afterAll(async () => {
    jest.restoreAllMocks();
    await fs.remove(root);
  });

  it('generates every module its files import (relative imports all resolve)', async () => {
    const unresolved: string[] = [];
    for (const file of files) {
      const content = await fs.readFile(path.join(root, file), 'utf8');
      for (const [, specifier] of content.matchAll(/(?:from|require\()\s*'(\.[^']*)'/g)) {
        const target = path.join(root, path.dirname(file), specifier);
        const exists = ['.ts', '.tsx', '/index.ts'].some(ext => fs.existsSync(`${target}${ext}`));
        if (!exists) unresolved.push(`${file} -> ${specifier}`);
      }
      if (/from '@\//.test(content)) unresolved.push(`${file} uses an @/ alias import`);
    }
    expect(unresolved).toEqual([]);
  });

  it("marks server modules with import 'server-only' and adds the dependency", async () => {
    for (const file of files.filter(f => SERVER_ONLY.includes(f))) {
      const content = await fs.readFile(path.join(root, file), 'utf8');
      expect({ file, first: content.trimStart().split('\n')[0].trim() }).toEqual({ file, first: "import 'server-only';" });
    }
    expect(dependencies).toEqual(expect.arrayContaining(['@hashgraph/sdk', 'server-only']));
  });

  it("marks hooks and components with 'use client'", async () => {
    for (const file of files.filter(f => /\/(hooks|components)\//.test(f))) {
      const content = await fs.readFile(path.join(root, file), 'utf8');
      expect({ file, first: content.trimStart().split('\n')[0].trim() }).toEqual({ file, first: "'use client';" });
    }
  });

  it('never creates the Hedera client or reads keys at import time', async () => {
    const client = await fs.readFile(path.join(root, 'src/lib/hedera/client.ts'), 'utf8');
    // process.env is only read inside createDefaultClient()
    const beforeFactory = client.slice(0, client.indexOf('function createDefaultClient'));
    expect(beforeFactory).not.toMatch(/process\.env/);
    for (const file of files.filter(f => /operations\.ts$/.test(f))) {
      const content = await fs.readFile(path.join(root, file), 'utf8');
      expect(content).not.toMatch(/this\.client\s*=\s*client\s*\|\|\s*createDefaultClient/);
    }
  });
});

describe('signing model and dependencies', () => {
  let root: string;

  const generate = async (integration: string): Promise<string[]> => {
    const context = nextContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan(integration, { name: 'MyToken', symbol: 'MTK' }, context);
    const generator = new IntegrationGenerator();
    await generator.initialize();
    await generator.generateIntegration(plan, context);
    return plan.templates.map(t => t.outputPath);
  };

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'apix-signing-'));
    await fs.writeJSON(path.join(root, 'package.json'), { name: 'app', version: '1.0.0', dependencies: { next: '16.3.6' } });
    await fs.outputFile(path.join(root, 'src/app/page.tsx'), 'export default function Page() { return null; }\n');
    jest.spyOn(PackageManager.prototype, 'installDependencies').mockResolvedValue();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.remove(root);
  });

  it('never sends the wallet account as treasury or sender (hts)', async () => {
    await generate('hts');
    const tokenManager = await fs.readFile(path.join(root, 'src/components/TokenManager.tsx'), 'utf8');
    expect(tokenManager).toMatch(/Signing model: every operation below is signed on the server by the\r?\n\/\/ operator account/);
    expect(tokenManager).not.toMatch(/(fromAccountId|treasuryAccountId):\s*wallet/);

    const transfer = await fs.readFile(path.join(root, 'src/app/api/tokens/transfer/route.ts'), 'utf8');
    const create = await fs.readFile(path.join(root, 'src/app/api/tokens/create/route.ts'), 'utf8');
    expect(transfer).not.toMatch(/body\.fromAccountId/);
    expect(create).not.toMatch(/body\.treasuryAccountId|createToken\(body\)/);
  }, 120_000);

  it('declares @hashgraph/sdk for wallet', async () => {
    await generate('wallet');
    const pkg = await fs.readJSON(path.join(root, 'package.json'));
    expect(pkg.dependencies['@hashgraph/sdk']).toBeDefined();
  }, 120_000);
});
