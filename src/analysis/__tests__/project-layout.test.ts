// src/analysis/__tests__/project-layout.test.ts
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { detectProjectLayout, parseJsonWithComments } from '../project-layout';

async function fixture(files: Record<string, string | null>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'apix-layout-'));
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) {
      await fs.ensureDir(path.join(root, rel)); // a directory
    } else {
      await fs.outputFile(path.join(root, rel), content);
    }
  }
  return root;
}

const tsconfig = (paths: Record<string, string[]>, extra = '') =>
  `{ "compilerOptions": { ${extra}"paths": ${JSON.stringify(paths)} } }`;

describe('detectProjectLayout', () => {
  const roots: string[] = [];
  const make = async (files: Record<string, string | null>) => {
    const root = await fixture(files);
    roots.push(root);
    return root;
  };

  afterAll(async () => {
    await Promise.all(roots.map(root => fs.remove(root)));
  });

  it('Next.js with src/app (create-next-app --src-dir)', async () => {
    const root = await make({ 'src/app': null, 'tsconfig.json': tsconfig({ '@/*': ['./src/*'] }) });
    expect(await detectProjectLayout(root, 'next.js')).toEqual({
      sourceRoot: 'src', router: 'app', routesDir: 'src/app', importAlias: { alias: '@/*', target: 'src' },
    });
  });

  it('Next.js with a root app/', async () => {
    const root = await make({ 'app': null, 'tsconfig.json': tsconfig({ '@/*': ['./*'] }) });
    expect(await detectProjectLayout(root, 'next.js')).toEqual({
      sourceRoot: '', router: 'app', routesDir: 'app', importAlias: { alias: '@/*', target: '' },
    });
  });

  it('Next.js pages router', async () => {
    const root = await make({ 'src/pages': null });
    expect(await detectProjectLayout(root, 'next.js')).toMatchObject({ sourceRoot: 'src', router: 'pages', routesDir: 'src/pages' });
  });

  it('prefers a root app/ over src/app, as Next.js does', async () => {
    const root = await make({ 'app': null, 'src/app': null });
    expect(await detectProjectLayout(root, 'next.js')).toMatchObject({ sourceRoot: '', routesDir: 'app' });
  });

  it('Next.js without a routes directory yet puts app/ in the source root', async () => {
    const root = await make({ 'src': null });
    expect(await detectProjectLayout(root, 'next.js')).toMatchObject({ sourceRoot: 'src', router: 'app', routesDir: 'src/app' });
  });

  it('no tsconfig paths: uses src/ if it exists, else the root', async () => {
    const withSrc = await make({ 'src': null, 'tsconfig.json': '{ "compilerOptions": {} }' });
    expect(await detectProjectLayout(withSrc, 'react')).toEqual({ sourceRoot: 'src', router: null, routesDir: null, importAlias: null });

    const withoutSrc = await make({ 'index.ts': '' });
    expect(await detectProjectLayout(withoutSrc, 'react')).toEqual({ sourceRoot: '', router: null, routesDir: null, importAlias: null });
  });

  it('custom alias and baseUrl decide the source root', async () => {
    const root = await make({ 'source': null, 'src': null, 'tsconfig.json': tsconfig({ '~/*': ['source/*'] }, '"baseUrl": ".", ') });
    expect(await detectProjectLayout(root, 'react')).toMatchObject({
      sourceRoot: 'source', importAlias: { alias: '~/*', target: 'source' },
    });
  });

  it('follows tsconfig references with comments and trailing commas (create-vite)', async () => {
    const root = await make({
      'src': null,
      'tsconfig.json': '{\n  // root config\n  "files": [],\n  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" },],\n}',
      'tsconfig.app.json': '{\n  /* app */\n  "compilerOptions": {\n    "paths": { "#/*": ["./src/*"], },\n  },\n}',
      'tsconfig.node.json': '{ "compilerOptions": {} }',
    });
    expect(await detectProjectLayout(root, 'react')).toMatchObject({ sourceRoot: 'src', importAlias: { alias: '#/*', target: 'src' } });
  });

  it('ignores an unparseable tsconfig', async () => {
    const root = await make({ 'src': null, 'tsconfig.json': '{ not json' });
    expect(await detectProjectLayout(root, 'react')).toMatchObject({ sourceRoot: 'src', importAlias: null });
  });
});

describe('parseJsonWithComments', () => {
  it('keeps comment-like text inside strings', () => {
    expect(parseJsonWithComments('{ "url": "https://x/*y*/", /* c */ "a": [1,], }')).toEqual({ url: 'https://x/*y*/', a: [1] });
  });
});
