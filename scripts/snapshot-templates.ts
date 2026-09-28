/**
 * Render every template with fixed sample inputs into an output directory, so
 * two snapshots (before/after a change) can be compared with `diff -r`.
 *
 * Usage: npm run snapshot:templates -- <output-dir>
 *
 * Output layout:
 *   templates/<context>/<templateId>.out   every .hbs under templates/, rendered
 *                                          directly through TemplateEngine
 *   integrations/<type>/...                the files and package.json that
 *                                          `apix add <type>` writes, produced by
 *                                          the real planner + generator
 *   unloaded-templates.txt                 .hbs files the engine never loads
 *
 * The only thing skipped is the package-manager install step (no network):
 * package.json is still written exactly as the generator writes it. Render
 * errors are recorded as <name>.error files instead of aborting the run.
 */
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { TemplateEngine, TemplateContext } from '../src/templates/template-engine';
import { IntegrationPlanner } from '../src/planning/integration-planner';
import { IntegrationGenerator } from '../src/generation/integration-generator';
import { PackageManager } from '../src/utils/package-manager';
import { logger, LogLevel } from '../src/utils/logger';
import { IntegrationOptions, ProjectContext, SupportedFramework } from '../src/types';

const INTEGRATION_TYPES = ['hts', 'wallet', 'smart-contract', 'consensus'];

const SAMPLE_OPTIONS: IntegrationOptions = { name: 'SnapshotToken', symbol: 'SNAP' };

function sampleProject(rootPath: string, framework: SupportedFramework, language: 'typescript' | 'javascript'): ProjectContext {
  return {
    framework,
    language,
    packageManager: 'npm',
    rootPath,
    dependencies: [],
    devDependencies: [],
    scripts: {},
    hasExistingAuth: false,
    hasStateManagement: null,
    hasUILibrary: null,
    projectStructure: {
      hasApiRoutes: true,
      hasPages: false,
      hasComponents: true,
      hasHooks: true,
      hasContexts: false,
      hasUtils: true,
      hasStyles: false,
      directories: ['app', 'components', 'lib'],
      configFiles: ['package.json', 'tsconfig.json'],
    },
    existingIntegrations: [],
  };
}

const TEMPLATE_CONTEXTS: Record<string, TemplateContext> = {
  'nextjs-typescript': {
    projectName: 'snapshot-app',
    framework: 'next.js',
    language: 'typescript',
    packageManager: 'npm',
    hederaNetwork: 'testnet',
    hasTypeScript: true,
    hasNextJs: true,
    hasReact: true,
    usesAppRouter: true,
    usesPagesRouter: false,
    ...SAMPLE_OPTIONS,
  },
  'react-javascript': {
    projectName: 'snapshot-app',
    framework: 'react',
    language: 'javascript',
    packageManager: 'npm',
    hederaNetwork: 'testnet',
    hasTypeScript: false,
    hasNextJs: false,
    hasReact: true,
    usesAppRouter: false,
    usesPagesRouter: false,
    ...SAMPLE_OPTIONS,
  },
};

function errorText(error: unknown): string {
  return `${error instanceof Error ? error.message : String(error)}\n`;
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : Promise.resolve([full]);
  }));
  return nested.flat();
}

async function snapshotTemplates(outDir: string): Promise<number> {
  const engine = new TemplateEngine();
  await engine.loadTemplates();
  const templates = engine.listTemplates().sort((a, b) => a.id.localeCompare(b.id));

  // .hbs files on disk that TemplateEngine never loads (so `apix` can't use them)
  const templatesRoot = path.join(__dirname, '..', 'templates');
  const loaded = new Set(templates.map(t => path.resolve(t.path)));
  const unloaded = (await listFiles(templatesRoot))
    .filter(file => file.endsWith('.hbs') && !loaded.has(path.resolve(file)))
    .map(file => path.relative(templatesRoot, file).split(path.sep).join('/'))
    .sort();
  await fs.ensureDir(outDir);
  await fs.writeFile(path.join(outDir, 'unloaded-templates.txt'), unloaded.map(f => `${f}\n`).join(''), 'utf8');

  for (const [name, context] of Object.entries(TEMPLATE_CONTEXTS)) {
    for (const template of templates) {
      const target = path.join(outDir, 'templates', name, template.id);
      await fs.ensureDir(path.dirname(target));
      try {
        const file = await engine.generateFile(template.id, context, template.id);
        await fs.writeFile(`${target}.out`, file.content, 'utf8');
      } catch (error) {
        await fs.writeFile(`${target}.error`, errorText(error), 'utf8');
      }
    }
  }
  return templates.length;
}

async function snapshotIntegrations(outDir: string): Promise<void> {
  // Skip `npm install` in the scratch project; package.json is still written.
  PackageManager.prototype.installDependencies = async () => {};

  const planner = new IntegrationPlanner();
  const generator = new IntegrationGenerator();
  await generator.initialize();

  for (const type of INTEGRATION_TYPES) {
    const target = path.join(outDir, 'integrations', type);
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), `apix-snapshot-${type}-`));
    try {
      await fs.writeJSON(path.join(scratch, 'package.json'), { name: 'snapshot-app', version: '0.0.0' }, { spaces: 2 });
      const context = sampleProject(scratch, 'next.js', 'typescript');
      const plan = await planner.createIntegrationPlan(type, { ...SAMPLE_OPTIONS }, context);
      await generator.generateIntegration(plan, context);
      await fs.copy(scratch, target, { filter: src => !src.includes('node_modules') });
    } catch (error) {
      await fs.ensureDir(target);
      await fs.writeFile(path.join(target, 'integration.error'), errorText(error), 'utf8');
    } finally {
      await fs.remove(scratch);
    }
  }
}

async function main(): Promise<void> {
  const outArg = process.argv[2];
  if (!outArg) {
    console.error('Usage: npm run snapshot:templates -- <output-dir>');
    process.exit(1);
  }
  const outDir = path.resolve(outArg);
  if (await fs.pathExists(outDir) && (await fs.readdir(outDir)).length > 0) {
    console.error(`Output directory is not empty: ${outDir}\nChoose a new directory so snapshots are never mixed.`);
    process.exit(1);
  }

  logger.setLevel(LogLevel.SILENT);
  const count = await snapshotTemplates(outDir);
  await snapshotIntegrations(outDir);
  console.log(`Rendered ${count} templates x ${Object.keys(TEMPLATE_CONTEXTS).length} contexts and ${INTEGRATION_TYPES.length} integrations into ${outDir}`);
}

main().catch(error => {
  console.error(errorText(error));
  process.exit(1);
});
