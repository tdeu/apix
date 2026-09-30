// src/utils/__tests__/package-manager.test.ts
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { PackageManager } from '../package-manager';

jest.mock('../logger');

describe('PackageManager.installDependencies', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'apix-pm-'));
  });

  afterEach(async () => {
    await fs.remove(root);
  });

  it("reports the command and the tail of npm's own output when the install fails", async () => {
    // An invalid package name: npm rejects it before touching the network
    await fs.writeJSON(path.join(root, 'package.json'), {
      name: 'app', version: '1.0.0', dependencies: { 'Invalid Name!': '1.0.0' },
    });

    const error: Error = await new PackageManager(root).installDependencies().then(
      () => { throw new Error('expected the install to fail'); },
      (e: Error) => e
    );

    expect(error.message).toContain(`Command: npm install (in ${root})`);
    expect(error.message).toMatch(/Exit code: \d+/);
    expect(error.message).toContain('npm output (last 30 lines):');
    // npm's actual explanation is there, not just "Command failed"
    expect(error.message).toContain('npm error code EINVALIDPACKAGENAME');
    expect(error.message).not.toMatch(/npm,install/);

    const output = error.message.split('npm output (last 30 lines):\n')[1].split('\n\nRun `npm install`')[0];
    expect(output.split('\n').length).toBeLessThanOrEqual(30);
  }, 120_000);
});

describe('a failing install during generation', () => {
  it("surfaces npm's error and rolls package.json back", async () => {
    const { IntegrationGenerator } = await import('../../generation/integration-generator');
    const { IntegrationPlanner } = await import('../../planning/integration-planner');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'apix-pm-gen-'));
    try {
      // Already broken before `apix add`: the real npm install fails offline
      const original = JSON.stringify({ name: 'app', version: '1.0.0', dependencies: { next: '16.3.6', 'Invalid Name!': '1.0.0' } }, null, 2);
      await fs.writeFile(path.join(root, 'package.json'), original);
      await fs.outputFile(path.join(root, 'src/app/page.tsx'), 'export default function Page() { return null; }\n');
      await fs.writeJSON(path.join(root, 'tsconfig.json'), { compilerOptions: {} });

      const context = {
        framework: 'next.js' as const, language: 'typescript' as const, packageManager: 'npm' as const, rootPath: root,
        dependencies: [], devDependencies: [], scripts: {}, hasExistingAuth: false, hasStateManagement: null,
        hasUILibrary: null, existingIntegrations: [],
        projectStructure: {
          hasApiRoutes: false, hasPages: false, hasComponents: false, hasHooks: false,
          hasContexts: false, hasUtils: false, hasStyles: false, directories: [], configFiles: [],
        },
      };
      const plan = await new IntegrationPlanner().createIntegrationPlan('wallet', {}, context);
      const generator = new IntegrationGenerator();
      await generator.initialize();

      await expect(generator.generateIntegration(plan, context)).rejects.toThrow(/npm error code EINVALIDPACKAGENAME/);
      expect(await fs.readFile(path.join(root, 'package.json'), 'utf8')).toBe(original);
      expect(await fs.pathExists(path.join(root, 'src/lib'))).toBe(false);
    } finally {
      await fs.remove(root);
    }
  }, 120_000);
});
