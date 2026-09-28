// src/templates/__tests__/template-engine.test.ts
import { TemplateEngine, TemplateContext } from '../template-engine';

jest.mock('../../utils/logger');

const SAMPLE_CONTEXTS: Record<string, TemplateContext> = {
  'next.js + typescript': {
    projectName: 'sample-app',
    framework: 'next.js',
    language: 'typescript',
    packageManager: 'npm',
    hederaNetwork: 'testnet',
    hasTypeScript: true,
    hasNextJs: true,
    hasReact: true,
    usesAppRouter: true,
    usesPagesRouter: false,
    usesSemicolons: true,
    quotesStyle: 'single',
    name: 'SampleToken',
    symbol: 'SMPL',
  },
  'react + javascript': {
    projectName: 'sample-app',
    framework: 'react',
    language: 'javascript',
    packageManager: 'npm',
    hederaNetwork: 'testnet',
    hasTypeScript: false,
    hasNextJs: false,
    hasReact: true,
    usesAppRouter: false,
    usesPagesRouter: false,
    usesSemicolons: false,
    quotesStyle: 'double',
    name: 'SampleToken',
    symbol: 'SMPL',
  },
};

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeAll(async () => {
    engine = new TemplateEngine();
    await engine.loadTemplates();
  });

  it('loads every .hbs file under templates/', async () => {
    expect(engine.listTemplates().length).toBeGreaterThan(0);
    expect(await engine.findUnloadedTemplates()).toEqual([]);
  });

  it('loads the shared Hedera types template', () => {
    expect(engine.getTemplate('types/common/hedera-types')).toBeDefined();
  });

  describe.each(Object.entries(SAMPLE_CONTEXTS))('with %s', (_name, context) => {
    it('renders every template without errors', async () => {
      const failures: string[] = [];
      for (const template of engine.listTemplates()) {
        try {
          await engine.generateFile(template.id, context, `out/${template.id}`);
        } catch (error) {
          failures.push(`${template.id}: ${error instanceof Error ? error.message.split('\n')[0] : error}`);
        }
      }
      expect(failures).toEqual([]);
    });
  });
});
