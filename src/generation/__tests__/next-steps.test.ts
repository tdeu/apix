// src/generation/__tests__/next-steps.test.ts
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

const CREDENTIALS = 'Set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in .env.local (server-side only, never NEXT_PUBLIC_). ' +
  'Get a free testnet account at https://portal.hedera.com/faucet';

describe('next steps', () => {
  let root: string;
  let generator: IntegrationGenerator;

  const add = async (integration: string) => {
    const context = nextContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan(integration, { name: 'MyToken', symbol: 'MTK' }, context);
    return (await generator.generateIntegration(plan, context)).nextSteps;
  };

  beforeAll(async () => {
    generator = new IntegrationGenerator();
    await generator.initialize();
  });

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'apix-next-steps-'));
    await fs.writeJSON(path.join(root, 'package.json'), { name: 'app', version: '1.0.0', dependencies: { next: '16.3.6' } });
    await fs.outputFile(path.join(root, 'src/app/page.tsx'), 'export default function Page() { return null; }\n');
    jest.spyOn(PackageManager.prototype, 'installDependencies').mockResolvedValue();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.remove(root);
  });

  it('hts: credentials, the four routes, the components it generated', async () => {
    expect(await add('hts')).toEqual([
      CREDENTIALS,
      'API route: POST /api/tokens/create',
      'API route: GET /api/tokens/info',
      'API route: POST /api/tokens/mint',
      'API route: POST /api/tokens/transfer',
      'Render <TransactionStatus /> (src/components/TransactionStatus.tsx) from a page',
      'Render <TokenManager /> (src/components/TokenManager.tsx) from a page',
      'Server-side helpers: src/lib/hedera/hts-operations.ts',
      'Start the dev server: npm run dev',
    ]);
  });

  it('wallet: no credentials or routes (nothing server-side)', async () => {
    expect(await add('wallet')).toEqual([
      'Render <WalletConnect /> (src/components/WalletConnect.tsx) from a page',
      'Start the dev server: npm run dev',
    ]);
  });

  it('consensus: credentials and its two routes', async () => {
    expect(await add('consensus')).toEqual([
      CREDENTIALS,
      'API route: POST /api/consensus/topics',
      'API route: POST /api/consensus/messages',
      'Server-side helpers: src/lib/hedera/consensus-operations.ts',
      'Start the dev server: npm run dev',
    ]);
  });

  it('never mentions things APIX does not generate', async () => {
    const steps = [...await add('hts'), ...await add('wallet'), ...await add('consensus')].join('\n');
    expect(steps).not.toMatch(/README|tests?\b|WalletProvider|TypeScript definitions/i);
  });
});
