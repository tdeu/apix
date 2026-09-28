// src/generation/__tests__/layout-generation.test.ts
import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { IntegrationGenerator } from '../integration-generator';
import { IntegrationPlanner } from '../../planning/integration-planner';
import { IntegrationValidator } from '../../validation/integration-validator';
import { PackageManager } from '../../utils/package-manager';
import { ProjectContext, SupportedFramework } from '../../types';
import { relativeImport } from '../module-paths';

jest.mock('../../utils/logger');
// ESM-only packages Jest can't load; a failing non-interactive `add` never prompts
jest.mock('inquirer', () => ({ __esModule: true, default: { prompt: jest.fn() } }));
jest.mock('ora', () => {
  const spinner: Record<string, unknown> = {};
  for (const method of ['start', 'stop', 'succeed', 'fail', 'warn', 'info']) {
    spinner[method] = () => spinner;
  }
  return { __esModule: true, default: () => spinner };
});

function projectContext(rootPath: string, framework: SupportedFramework = 'next.js'): ProjectContext {
  return {
    framework,
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

/** Every file and directory under root, with a hash of each file's bytes */
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

const NEXT_PACKAGE = {
  name: 'app', version: '1.0.0', scripts: { dev: 'next dev' },
  dependencies: { next: '16.3.6', react: '19.0.0', 'react-dom': '19.0.0' },
};

async function nextFixture(layout: 'src-app' | 'root-app' | 'pages'): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `apix-gen-${layout}-`));
  await fs.writeJSON(path.join(root, 'package.json'), NEXT_PACKAGE, { spaces: 2 });
  if (layout === 'src-app') {
    await fs.outputFile(path.join(root, 'src/app/page.tsx'), 'export default function Page() { return null; }\n');
    await fs.writeJSON(path.join(root, 'tsconfig.json'), { compilerOptions: { paths: { '@/*': ['./src/*'] } } });
  } else if (layout === 'root-app') {
    await fs.outputFile(path.join(root, 'app/page.tsx'), 'export default function Page() { return null; }\n');
    await fs.writeJSON(path.join(root, 'tsconfig.json'), { compilerOptions: { paths: { '@/*': ['./*'] } } });
  } else {
    await fs.outputFile(path.join(root, 'src/pages/index.tsx'), 'export default function Home() { return null; }\n');
  }
  return root;
}

describe('layout-aware planning and generation', () => {
  const roots: string[] = [];
  const fixture = async (layout: 'src-app' | 'root-app' | 'pages') => {
    const root = await nextFixture(layout);
    roots.push(root);
    return root;
  };

  beforeEach(() => {
    jest.spyOn(PackageManager.prototype, 'installDependencies').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await Promise.all(roots.map(root => fs.remove(root)));
  });

  it('puts every file under src/ and the routes in src/app for a src/app project', async () => {
    const root = await fixture('src-app');
    const plan = await new IntegrationPlanner().createIntegrationPlan('hts', { name: 'MyToken', symbol: 'MTK' }, projectContext(root));
    const paths = plan.templates.map(t => t.outputPath);

    expect(paths).toContain('src/app/api/tokens/create/route.ts');
    expect(paths).toContain('src/lib/hedera/hts-operations.ts');
    expect(paths.every(p => p.startsWith('src/'))).toBe(true);
  });

  it('uses the root for a root app/ project', async () => {
    const root = await fixture('root-app');
    const plan = await new IntegrationPlanner().createIntegrationPlan('hts', { name: 'MyToken', symbol: 'MTK' }, projectContext(root));
    const paths = plan.templates.map(t => t.outputPath);

    expect(paths).toContain('app/api/tokens/create/route.ts');
    expect(paths).toContain('lib/hedera/hts-operations.ts');
  });

  it('refuses API routes for a Pages Router project, but still plans wallet files', async () => {
    const root = await fixture('pages');
    const planner = new IntegrationPlanner();

    await expect(planner.createIntegrationPlan('hts', { name: 'MyToken', symbol: 'MTK' }, projectContext(root)))
      .rejects.toThrow(/only generated for the Next\.js App Router/);

    const wallet = await planner.createIntegrationPlan('wallet', {}, projectContext(root));
    expect(wallet.templates.map(t => t.outputPath)).toContain('src/lib/hedera/wallet-service.ts');
  });

  it('writes relative imports between generated files, and no @/ imports', async () => {
    const root = await fixture('src-app');
    const context = projectContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan('hts', { name: 'MyToken', symbol: 'MTK' }, context);
    const generator = new IntegrationGenerator();
    await generator.initialize();

    await generator.generateIntegration(plan, context);

    const route = await fs.readFile(path.join(root, 'src/app/api/tokens/create/route.ts'), 'utf8');
    expect(route).toContain(`from '${relativeImport('src/app/api/tokens/create/route.ts', 'src/lib/hedera/hts-operations')}'`);
    expect(route).toContain("from '../../../../lib/hedera/hts-operations'");

    for (const file of plan.templates.map(t => t.outputPath)) {
      const content = await fs.readFile(path.join(root, file), 'utf8');
      expect({ file, aliasImports: content.match(/from '@\/[^']*'/g) }).toEqual({ file, aliasImports: null });
    }
    expect(await fs.pathExists(path.join(root, 'app'))).toBe(false);
  });

  it('leaves the project byte-for-byte unchanged when a template fails to render', async () => {
    const root = await fixture('src-app');
    const context = projectContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan('hts', { name: 'MyToken', symbol: 'MTK' }, context);
    plan.templates.push({ ...plan.templates[0], templateId: 'utils/common/does-not-exist', outputPath: 'src/lib/x.ts' });
    const generator = new IntegrationGenerator();
    await generator.initialize();
    const before = await treeSnapshot(root);

    await expect(generator.generateIntegration(plan, context)).rejects.toThrow(/Template not found/);

    expect(await treeSnapshot(root)).toEqual(before);
  });

  it('restores package.json when installing dependencies fails', async () => {
    const root = await fixture('src-app');
    const context = projectContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan('hts', { name: 'MyToken', symbol: 'MTK' }, context);
    const generator = new IntegrationGenerator();
    await generator.initialize();
    jest.spyOn(PackageManager.prototype, 'installDependencies').mockRejectedValue(new Error('npm install failed'));
    const before = await treeSnapshot(root);

    await expect(generator.generateIntegration(plan, context)).rejects.toThrow('npm install failed');

    expect(await treeSnapshot(root)).toEqual(before);
  });

  it('validates directories without creating them', async () => {
    const root = await fixture('src-app');
    const context = projectContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan('hts', { name: 'MyToken', symbol: 'MTK' }, context);
    const before = await treeSnapshot(root);

    await new IntegrationValidator().validateIntegrationPlan(context, plan);

    expect(await treeSnapshot(root)).toEqual(before);
  });

  it('rejects a plan that would create a root app/ next to src/app', async () => {
    const root = await fixture('src-app');
    const context = projectContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan('hts', { name: 'MyToken', symbol: 'MTK' }, context);
    plan.templates.push({ ...plan.templates[1], outputPath: 'app/api/tokens/extra/route.ts' });

    const report = await new IntegrationValidator().validateIntegrationPlan(context, plan);

    expect(report.passed).toBe(false);
    expect(JSON.stringify(report)).toMatch(/root app\/ next to src\/app/);
  });
});

describe('a failed `apix add` leaves the project byte-for-byte unchanged', () => {
  const cwd = process.cwd();
  let root: string;

  beforeEach(() => {
    jest.spyOn(PackageManager.prototype, 'installDependencies').mockResolvedValue();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    process.chdir(cwd);
    jest.restoreAllMocks();
    await fs.remove(root);
  });

  it.each([
    ['consensus on a Pages Router project', 'pages' as const, 'consensus', {}],
    ['hts on a Pages Router project', 'pages' as const, 'hts', { name: 'MyToken', symbol: 'MTK' }],
  ])('%s', async (_name, layout, integration, options) => {
    root = await nextFixture(layout);
    const before = await treeSnapshot(root);
    process.chdir(root);
    // Imported lazily: cli-core pulls in the whole CLI
    const { APIxCLI } = await import('../../cli/cli-core');
    const cli = new APIxCLI();
    await cli.initialize();

    await expect(cli.addIntegration(integration, options)).rejects.toThrow();

    process.chdir(cwd);
    expect(await treeSnapshot(root)).toEqual(before);
  }, 180_000); // the first import of cli-core compiles the whole CLI
});
