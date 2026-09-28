// src/generation/__tests__/integration-generator.test.ts
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { IntegrationGenerator } from '../integration-generator';
import { HEDERA_SDK_VERSION_RANGE, generatedDependencyVersion } from '../dependency-versions';
import { IntegrationPlanner } from '../../planning/integration-planner';
import { PackageManager } from '../../utils/package-manager';
import { ProjectContext } from '../../types';

jest.mock('../../utils/logger');

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
      hasApiRoutes: true, hasPages: false, hasComponents: true, hasHooks: true,
      hasContexts: false, hasUtils: true, hasStyles: false, directories: [], configFiles: []
    },
    existingIntegrations: []
  };
}

describe('generated dependency versions', () => {
  it('pins the SDK range to the @hashgraph/sdk version APIX itself uses', async () => {
    const ownPackage = await fs.readJSON(path.join(__dirname, '..', '..', '..', 'package.json'));
    expect(HEDERA_SDK_VERSION_RANGE).toBe(`^${ownPackage.dependencies['@hashgraph/sdk']}`);
  });

  it('refuses to invent a version for an unknown dependency', () => {
    expect(() => generatedDependencyVersion('left-pad')).toThrow(/No version range defined/);
  });
});

describe('IntegrationGenerator', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'apix-generate-'));
    await fs.writeJSON(path.join(root, 'package.json'), { name: 'app', version: '1.0.0' });
    // Don't run npm install in the scratch project; package.json is still written
    jest.spyOn(PackageManager.prototype, 'installDependencies').mockResolvedValue();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.remove(root);
  });

  it('writes the pinned @hashgraph/sdk range into the generated package.json', async () => {
    const context = projectContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan('hts', { name: 'MyToken', symbol: 'MTK' }, context);
    const generator = new IntegrationGenerator();
    await generator.initialize();

    await generator.generateIntegration(plan, context);

    const written = await fs.readJSON(path.join(root, 'package.json'));
    expect(written.dependencies['@hashgraph/sdk']).toBe(HEDERA_SDK_VERSION_RANGE);
    expect(written.dependencies['@hashgraph/sdk']).not.toBe('latest');
  });

  it('does not offer walletconnect as a provider in generated wallet code', async () => {
    const context = projectContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan('wallet', {}, context);
    const generator = new IntegrationGenerator();
    await generator.initialize();

    await generator.generateIntegration(plan, context);

    const walletService = await fs.readFile(path.join(root, 'lib', 'hedera', 'wallet-service.ts'), 'utf8');
    expect(walletService).toMatch(/export type WalletProvider = /);
    expect(walletService).not.toMatch(/'walletconnect'/);
  });
});
