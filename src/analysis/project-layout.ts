// src/analysis/project-layout.ts
import fs from 'fs-extra';
import path from 'path';
import { SupportedFramework } from '../types';

/**
 * Where a project keeps its code, read from disk. All paths are relative to
 * the project root, use forward slashes, and '' means the root itself.
 */
export interface ProjectLayout {
  /** Directory application code lives in: 'src' or '' */
  sourceRoot: string;
  /** Next.js router in use ('app' if the project has neither yet); null for other frameworks */
  router: 'app' | 'pages' | null;
  /** Next.js routes directory ('src/app', 'app', 'src/pages', 'pages'); null for other frameworks */
  routesDir: string | null;
  /** First tsconfig `paths` alias ending in /*, e.g. { alias: '@/*', target: 'src' }; null if none */
  importAlias: { alias: string; target: string } | null;
}

/**
 * Parse tsconfig-style JSON: tolerates // and block comments and trailing
 * commas (create-vite's tsconfigs have both).
 */
export function parseJsonWithComments(text: string): unknown {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += text[++i] ?? '';
      } else if (ch === '"') {
        inString = false;
      }
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else {
      out += ch;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

const toPosix = (p: string) => p.split(path.sep).join('/');

interface TsConfig {
  compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
  references?: Array<{ path?: string }>;
}

/**
 * Read `paths` aliases from tsconfig.json, following `references` one level
 * (create-vite keeps compilerOptions in tsconfig.app.json).
 */
async function readImportAlias(rootPath: string): Promise<ProjectLayout['importAlias']> {
  const configFiles = ['tsconfig.json'];
  const visited = new Set<string>();

  while (configFiles.length > 0) {
    const file = path.resolve(rootPath, configFiles.shift()!);
    if (visited.has(file) || !await fs.pathExists(file)) continue;
    visited.add(file);

    let config: TsConfig | undefined;
    try {
      config = parseJsonWithComments(await fs.readFile(file, 'utf8')) as TsConfig;
    } catch {
      continue; // an unreadable tsconfig just means no alias information
    }

    const options = config?.compilerOptions ?? {};
    const baseUrl = path.resolve(path.dirname(file), options.baseUrl ?? '.');
    for (const [alias, targets] of Object.entries<string[]>(options.paths ?? {})) {
      const target = Array.isArray(targets) ? targets[0] : undefined;
      if (alias.endsWith('/*') && typeof target === 'string' && target.endsWith('/*')) {
        const dir = path.relative(rootPath, path.resolve(baseUrl, target.slice(0, -2)));
        if (!dir.startsWith('..')) {
          return { alias, target: toPosix(dir) };
        }
      }
    }

    for (const reference of config?.references ?? []) {
      if (typeof reference?.path === 'string') {
        const refPath = path.resolve(path.dirname(file), reference.path);
        configFiles.push((await fs.pathExists(refPath) && (await fs.stat(refPath)).isDirectory())
          ? path.join(refPath, 'tsconfig.json')
          : refPath);
      }
    }
  }
  return null;
}

async function isDir(p: string): Promise<boolean> {
  return (await fs.pathExists(p)) && (await fs.stat(p)).isDirectory();
}

export async function detectProjectLayout(rootPath: string, framework: SupportedFramework): Promise<ProjectLayout> {
  const importAlias = await readImportAlias(rootPath);
  const has = (rel: string) => isDir(path.join(rootPath, rel));

  if (framework === 'next.js') {
    // Next.js ignores src/app and src/pages when app/ or pages/ exist at the root
    for (const sourceRoot of ['', 'src']) {
      const prefix = sourceRoot ? `${sourceRoot}/` : '';
      if (await has(`${prefix}app`)) {
        return { sourceRoot, router: 'app', routesDir: `${prefix}app`, importAlias };
      }
      if (await has(`${prefix}pages`)) {
        return { sourceRoot, router: 'pages', routesDir: `${prefix}pages`, importAlias };
      }
    }
  }

  const sourceRoot = importAlias ? importAlias.target : (await has('src') ? 'src' : '');
  if (framework === 'next.js') {
    // No routes directory yet: the app router, inside the source root
    return { sourceRoot, router: 'app', routesDir: sourceRoot ? `${sourceRoot}/app` : 'app', importAlias };
  }
  return { sourceRoot, router: null, routesDir: null, importAlias };
}
