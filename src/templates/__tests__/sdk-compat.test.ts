// src/templates/__tests__/sdk-compat.test.ts
//
// Type-checks generated code against the @hiero-ledger/sdk installed in this repo,
// so an SDK bump that breaks the templates fails CI. react, next/server and
// server-only aren't installed here, so they are shimmed as `any`: whatever
// errors remain come from our code or the SDK.
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import ts from 'typescript';
import { TemplateEngine } from '../template-engine';
import { IntegrationGenerator } from '../../generation/integration-generator';
import { IntegrationPlanner } from '../../planning/integration-planner';
import { modulePathMap } from '../../generation/module-paths';
import { PackageManager } from '../../utils/package-manager';
import { ProjectContext } from '../../types';

jest.mock('../../utils/logger');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SDK_DIR = path.join(REPO_ROOT, 'node_modules', '@hiero-ledger', 'sdk');

const SHIMS = `
declare module 'react';
declare module 'server-only';
declare module 'next/server' {
  export class NextRequest extends Request { readonly nextUrl: URL; }
  export class NextResponse extends Response { static json(body: unknown, init?: ResponseInit): NextResponse; }
}
declare namespace JSX {
  interface IntrinsicElements { [name: string]: any }
  interface Element {}
}
`;

function compilerOptions(baseUrl: string): ts.CompilerOptions {
  return {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    esModuleInterop: true,
    lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
    types: ['node'],
    typeRoots: [path.join(REPO_ROOT, 'node_modules', '@types')],
    // Not the repo root: bare imports must not resolve to files in this repo
    baseUrl,
    paths: { '@hiero-ledger/sdk': [SDK_DIR] },
  };
}

function typeCheck(files: string[], shimsFile: string): ts.Program {
  return ts.createProgram([...files, shimsFile], compilerOptions(path.dirname(shimsFile)));
}

function format(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (!diagnostic.file || diagnostic.start === undefined) return message;
  const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `${diagnostic.file.fileName.replace(/\\/g, '/').split('/src/').pop()}:${line + 1} ${message}`;
}

function isSdkDeclaration(symbol: ts.Symbol | undefined): boolean {
  return !!symbol?.declarations?.some(d => d.getSourceFile().fileName.replace(/\\/g, '/').includes('/@hiero-ledger/'));
}

/** True if the diagnostic is about an SDK import, member, call or value */
function isSdkDiagnostic(program: ts.Program, diagnostic: ts.Diagnostic): boolean {
  if (ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n').includes('"@hiero-ledger/sdk"')) return true;
  if (!diagnostic.file || diagnostic.start === undefined) return false;

  const checker = program.getTypeChecker();
  const findNode = (node: ts.Node): ts.Node | undefined =>
    node.getStart() <= diagnostic.start! && diagnostic.start! < node.getEnd()
      ? ts.forEachChild(node, findNode) ?? node
      : undefined;

  for (let node = findNode(diagnostic.file); node; node = node.parent) {
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const type = checker.getTypeAtLocation(node.expression);
      const members = [type.getSymbol(), type.aliasSymbol, ...(type.isUnion() ? type.types.map(t => t.getSymbol()) : [])];
      if (members.some(isSdkDeclaration)) return true;
      if (ts.isPropertyAccessExpression(node) && isSdkDeclaration(checker.getSymbolAtLocation(node.name))) return true;
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      if (isSdkDeclaration(checker.getSymbolAtLocation(node.expression))) return true;
    }
    if (ts.isStatement(node)) break; // attribute within the statement only
  }
  return false;
}

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

describe('templates against the installed @hiero-ledger/sdk', () => {
  let tmp: string;
  let shimsFile: string;

  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'apix-sdk-compat-'));
    shimsFile = path.join(tmp, 'shims.d.ts');
    await fs.writeFile(shimsFile, SHIMS);
  });

  afterAll(async () => {
    await fs.remove(tmp);
  });

  // Server side only: hooks and components need real React types (checked by
  // the e2e build); they don't import the SDK.
  it.each(['hts', 'smart-contract', 'consensus'])('the server code `apix add %s` generates for Next.js compiles with no errors', async integration => {
    const root = path.join(tmp, integration);
    await fs.outputJSON(path.join(root, 'package.json'), { name: 'app', version: '1.0.0', dependencies: { next: '16.3.6' } });
    await fs.outputFile(path.join(root, 'src/app/page.tsx'), 'export default function Page() { return null; }\n');
    const install = jest.spyOn(PackageManager.prototype, 'installDependencies').mockResolvedValue();

    const context = nextContext(root);
    const plan = await new IntegrationPlanner().createIntegrationPlan(integration, { name: 'MyToken', symbol: 'MTK' }, context);
    const generator = new IntegrationGenerator();
    await generator.initialize();
    await generator.generateIntegration(plan, context);
    install.mockRestore();

    const serverFiles = plan.templates
      .map(t => t.outputPath)
      .filter(p => !/\/(hooks|components)\//.test(p));
    expect(serverFiles.length).toBeGreaterThan(0);
    const program = typeCheck(serverFiles.map(p => path.join(root, p)), shimsFile);
    expect(ts.getPreEmitDiagnostics(program).map(format)).toEqual([]);
  }, 60_000);

  it('no template uses an SDK API that the installed version lacks', async () => {
    const engine = new TemplateEngine();
    await engine.loadTemplates();
    const modulePaths = modulePathMap({ sourceRoot: 'src', router: 'app', routesDir: 'src/app', importAlias: null });
    const context = {
      projectName: 'app', framework: 'next.js' as const, language: 'typescript' as const, packageManager: 'npm' as const,
      hederaNetwork: 'testnet' as const, hasTypeScript: true, hasNextJs: true, hasReact: true, usesAppRouter: true,
      usesSemicolons: true, quotesStyle: 'single', name: 'MyToken', symbol: 'MTK', __modulePaths: modulePaths,
    };

    const files: string[] = [];
    for (const template of engine.listTemplates()) {
      const jsx = /^components\//.test(template.id);
      const outputPath = `src/${template.id}.${jsx ? 'tsx' : 'ts'}`;
      const file = await engine.generateFile(template.id, { ...context, __outputPath: outputPath }, outputPath);
      const target = path.join(tmp, 'all', outputPath);
      await fs.outputFile(target, file.content);
      files.push(target);
    }

    const program = typeCheck(files, shimsFile);
    const sdkErrors = ts.getPreEmitDiagnostics(program)
      .filter(d => isSdkDiagnostic(program, d))
      .map(format);
    expect(sdkErrors).toEqual([]);
  }, 60_000);
});
