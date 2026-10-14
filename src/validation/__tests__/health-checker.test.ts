// src/validation/__tests__/health-checker.test.ts
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { HealthChecker, HealthArea } from '../health-checker';
import { ProjectContext } from '../../types';

jest.mock('../../utils/logger');

const ENV_KEYS = [
  'HEDERA_ACCOUNT_ID', 'HEDERA_PRIVATE_KEY', 'HEDERA_NETWORK',
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'WALLETCONNECT_PROJECT_ID'
];

function projectContext(rootPath: string): ProjectContext {
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

function statusOf(areas: HealthArea[], name: string): string | undefined {
  return areas.find(area => area.name === name)?.status;
}

describe('HealthChecker areas', () => {
  let root: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'apix-health-'));
    await fs.writeJSON(path.join(root, 'package.json'), {
      name: 'app',
      version: '1.0.0',
      dependencies: { '@hiero-ledger/sdk': '^2.80.0' }
    });
    await fs.outputJSON(path.join(root, 'node_modules', '@hiero-ledger', 'sdk', 'package.json'), { version: '2.80.0' });
  });

  afterEach(async () => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    await fs.remove(root);
  });

  it('reports keys as "not configured" without any keys, and only local use', async () => {
    const areas = await new HealthChecker(projectContext(root)).checkAreas();

    expect(areas.map(area => area.name)).toEqual([
      'Project', 'Dependencies', 'Hedera SDK', 'Hedera credentials', 'AI key', 'WalletConnect project ID'
    ]);
    expect(statusOf(areas, 'Project')).toBe('ok');
    expect(statusOf(areas, 'Dependencies')).toBe('ok');
    expect(statusOf(areas, 'Hedera SDK')).toBe('ok');
    expect(statusOf(areas, 'Hedera credentials')).toBe('not configured');
    expect(statusOf(areas, 'AI key')).toBe('not configured');
    expect(statusOf(areas, 'WalletConnect project ID')).toBe('not configured');

    const summary = HealthChecker.summarizeAreas(areas);
    expect(summary).toMatch(/^Ready for local use/);
    expect(HealthChecker.formatAreas(areas)).not.toMatch(/healthy/i);
  });

  it('exits 0 by default and 1 with --strict when anything is not ok', async () => {
    const areas = await new HealthChecker(projectContext(root)).checkAreas();

    expect(HealthChecker.exitCode(areas, false)).toBe(0);
    expect(HealthChecker.exitCode(areas, true)).toBe(1);
  });

  it('exits 0 with --strict only when every area is ok', () => {
    const allOk: HealthArea[] = [{ name: 'Project', status: 'ok', message: '' }];
    expect(HealthChecker.exitCode(allOk, true)).toBe(0);
  });

  it('reports blockchain readiness only with well-formed Hedera credentials', async () => {
    process.env.HEDERA_ACCOUNT_ID = '0.0.1234';
    process.env.HEDERA_PRIVATE_KEY = 'a'.repeat(64);

    const areas = await new HealthChecker(projectContext(root)).checkAreas();

    expect(statusOf(areas, 'Hedera credentials')).toBe('ok');
    expect(HealthChecker.summarizeAreas(areas)).toBe('Ready for blockchain operations');
  });

  it('reports malformed Hedera credentials as an error', async () => {
    process.env.HEDERA_ACCOUNT_ID = '0.0.xxxxx';
    process.env.HEDERA_PRIVATE_KEY = '302e020100300506032b657004220420...';

    const areas = await new HealthChecker(projectContext(root)).checkAreas();

    expect(statusOf(areas, 'Hedera credentials')).toBe('error');
    expect(HealthChecker.summarizeAreas(areas)).toMatch(/^Not ready/);
  });

  it('flags .env.example placeholder values instead of reporting them ok', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-...';
    process.env.WALLETCONNECT_PROJECT_ID = 'your-walletconnect-project-id';

    const areas = await new HealthChecker(projectContext(root)).checkAreas();

    expect(statusOf(areas, 'AI key')).toBe('error');
    expect(statusOf(areas, 'WalletConnect project ID')).toBe('error');
  });

  it('never prints key values', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-secretsecretsecret';
    process.env.HEDERA_ACCOUNT_ID = '0.0.1234';
    process.env.HEDERA_PRIVATE_KEY = 'b'.repeat(64);

    const output = HealthChecker.formatAreas(await new HealthChecker(projectContext(root)).checkAreas());

    expect(output).not.toContain('secretsecret');
    expect(output).not.toContain('b'.repeat(8));
  });

  it('reports @hiero-ledger/sdk as the Hedera SDK', async () => {
    const checker = new HealthChecker(projectContext(root));
    const sdk = (await checker.checkAreas()).find(area => area.name === 'Hedera SDK');
    expect(sdk?.status).toBe('ok');
    expect(sdk?.message).toBe('@hiero-ledger/sdk 2.80.0 installed (declared ^2.80.0)');

    const { checks } = await checker.runCompleteHealthCheck();
    expect(checks['hedera-sdk'].status).toBe('pass');
    expect(checks['hedera-sdk'].details).toContain('Package: @hiero-ledger/sdk');
  });

  it('accepts @hashgraph/sdk in an app generated by APIX 2.1.x', async () => {
    await fs.remove(path.join(root, 'node_modules', '@hiero-ledger'));
    await fs.writeJSON(path.join(root, 'package.json'), {
      name: 'app', version: '1.0.0', dependencies: { '@hashgraph/sdk': '~2.80.0' }
    });
    await fs.outputJSON(path.join(root, 'node_modules', '@hashgraph', 'sdk', 'package.json'), { version: '2.80.0' });

    const checker = new HealthChecker(projectContext(root));
    const sdk = (await checker.checkAreas()).find(area => area.name === 'Hedera SDK');
    expect(sdk?.status).toBe('ok');
    expect(sdk?.message).toBe('@hashgraph/sdk 2.80.0 installed (declared ~2.80.0)');

    // `apix health --full` runs the older dependency and SDK checks
    const { checks } = await checker.runCompleteHealthCheck();
    expect(checks['hedera-sdk'].status).toBe('pass');
    expect(checks['hedera-sdk'].details).toContain('Package: @hashgraph/sdk');
    expect(checks['dependencies'].details ?? []).not.toEqual(expect.arrayContaining([expect.stringMatching(/sdk/i)]));
  });

  it('reports a missing package.json as an error', async () => {
    await fs.remove(path.join(root, 'package.json'));

    const areas = await new HealthChecker(projectContext(root)).checkAreas();

    expect(statusOf(areas, 'Project')).toBe('error');
    expect(statusOf(areas, 'Hedera SDK')).toBe('not configured');
  });
});
