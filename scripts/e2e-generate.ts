/**
 * Generation e2e harness: does `apix add <type>` produce code that installs,
 * type-checks and builds in a fresh project, with no manual fixes?
 *
 * Usage: npm run e2e:generate -- [--framework next|next-pages|vite|all]
 *                                [--case baseline,hts,all] [--out <dir>]
 *                                [--no-build-apix] [--min-free-mb 1536]
 *
 * Defaults: --framework next, every case. Rerun one case cheaply with e.g.
 *   npm run e2e:generate -- --framework vite --case wallet
 *
 * Frameworks: next (create-next-app, App Router, src/), next-pages (the same
 * app converted to the Pages Router) and vite (create-vite react-ts).
 *
 * For each framework it scaffolds one fresh app (pinned scaffolder version),
 * then, strictly one case at a time (a no-op "baseline" control, each
 * type `apix add` accepts on its own copy, and "all": every integration the
 * framework supports on one copy), it:
 *   1. copies the app (without node_modules)
 *   2. runs `apix add <type>` for each type in the case (non-interactive, no
 *      Hedera/AI keys, so no network calls to Hedera)
 *   3. runs npm install, the type check and the production build
 * A type the framework must refuse (see `refused`) passes only if `add`
 * fails and the project is byte-for-byte unchanged; it shows as "refused".
 * and prints a pass/fail table. Logs for every step are kept under the output
 * directory (printed at the end), and results.json is rewritten after every
 * case. Before each case it checks free memory and stops if it is below
 * --min-free-mb, because Windows then fails to start processes (0xC0000142)
 * and the results are meaningless. Exits 1 if any step failed or it stopped.
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

// Pinned so results are reproducible; bump deliberately.
const CREATE_NEXT_APP_VERSION = '16.3.6';
const CREATE_VITE_VERSION = '9.2.1';

// Every type `apix add` accepts, including aliases and refused ones.
const ADVERTISED_TYPES = ['hts', 'wallet', 'smart-contract', 'consensus', 'account', 'hcs', 'contract'];
const ALIASES: Record<string, string> = { hcs: 'consensus', contract: 'smart-contract' };
const canonical = (type: string) => ALIASES[type] ?? type;
// Integrations that can be supported somewhere; "all" adds the ones a framework supports
const INTEGRATIONS = ['hts', 'wallet', 'smart-contract', 'consensus'];

const STEP_TIMEOUT_MS = 15 * 60 * 1000;
const REPO_ROOT = path.resolve(__dirname, '..');
const APIX_BIN = path.join(REPO_ROOT, 'dist', 'cli', 'index.js');

type Framework = 'next' | 'next-pages' | 'vite';
// 'refused': an expected refusal (add failed and the project is unchanged)
type StepStatus = 'pass' | 'FAIL' | 'refused' | '-';

interface FrameworkConfig {
  // Called with a bare directory name (create-vite mangles absolute Windows paths)
  scaffold: (name: string) => string;
  // Adjusts the scaffolded app (in place)
  postScaffold?: (dir: string) => Promise<void>;
  typecheck: string;
  build: string;
  // Integrations `apix add` must refuse on this framework (canonical names)
  refused: string[];
}

const nextScaffold = (name: string) =>
  `npx -y create-next-app@${CREATE_NEXT_APP_VERSION} ${name} --ts --app --eslint --tailwind ` +
  '--src-dir --import-alias "@/*" --use-npm --yes --skip-install --disable-git';

const FRAMEWORKS: Record<Framework, FrameworkConfig> = {
  next: {
    scaffold: nextScaffold,
    // Next 16 generates route types (LayoutProps, PageProps) with typegen/build
    typecheck: 'npx next typegen && npx tsc --noEmit',
    build: 'npx next build',
    refused: ['account'],
  },
  // create-next-app has no Pages Router option: convert the App Router scaffold
  'next-pages': {
    scaffold: nextScaffold,
    postScaffold: async dir => {
      await fs.remove(path.join(dir, 'src', 'app'));
      await fs.outputFile(path.join(dir, 'src', 'pages', '_app.tsx'),
        "import type { AppProps } from 'next/app';\n\n" +
        'export default function App({ Component, pageProps }: AppProps) {\n  return <Component {...pageProps} />;\n}\n');
      await fs.outputFile(path.join(dir, 'src', 'pages', 'index.tsx'),
        'export default function Home() {\n  return <main>Home</main>;\n}\n');
    },
    typecheck: 'npx next typegen && npx tsc --noEmit',
    build: 'npx next build',
    // API route templates are App Router only
    refused: ['account', 'hts', 'consensus'],
  },
  vite: {
    scaffold: name => `npx -y create-vite@${CREATE_VITE_VERSION} ${name} --template react-ts --no-interactive --no-immediate`,
    // The react-ts template's root tsconfig only has project references
    typecheck: 'npx tsc -b',
    build: 'npx vite build',
    // They need a server to hold the operator key
    refused: ['account', 'hts', 'smart-contract', 'consensus'],
  },
};

interface CaseResult {
  framework: Framework;
  name: string;
  add: StepStatus;
  addDetail: string;
  install: StepStatus;
  typecheck: StepStatus;
  build: StepStatus;
  typeErrors: string[];
}

interface Args {
  frameworks: Framework[];
  cases: string[] | null;
  out: string;
  buildApix: boolean;
  minFreeMb: number;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const fw = get('--framework') ?? 'next';
  if (!['next', 'next-pages', 'vite', 'all'].includes(fw)) {
    throw new Error(`--framework must be next, next-pages, vite or all (got "${fw}")`);
  }
  // --only is the original name of --case
  const cases = (get('--case') ?? get('--only'))?.split(',').map(s => s.trim()).filter(Boolean) ?? null;
  const unknown = cases?.filter(t => !ADVERTISED_TYPES.includes(t) && t !== 'all' && t !== 'baseline') ?? [];
  if (unknown.length > 0) {
    throw new Error(`Unknown case(s) in --case: ${unknown.join(', ')}. Valid: baseline, ${ADVERTISED_TYPES.join(', ')}, all`);
  }
  const minFreeMb = Number(get('--min-free-mb') ?? 1536);
  if (!Number.isFinite(minFreeMb) || minFreeMb < 0) {
    throw new Error('--min-free-mb must be a non-negative number');
  }
  return {
    frameworks: fw === 'all' ? ['next', 'next-pages', 'vite'] : [fw as Framework],
    cases,
    out: path.resolve(get('--out') ?? path.join(os.tmpdir(), `apix-e2e-${Date.now()}`)),
    buildApix: !argv.includes('--no-build-apix'),
    minFreeMb,
  };
}

// No Hedera/AI/WalletConnect keys, so `add` never offers a real token creation
const CHILD_ENV: NodeJS.ProcessEnv = Object.fromEntries(
  Object.entries({ ...process.env, CI: '1', NEXT_TELEMETRY_DISABLED: '1' }).filter(([key]) =>
    !/^(HEDERA_|ANTHROPIC_|OPENAI_|GROQ_|WALLETCONNECT_)/.test(key)
  )
);

function run(command: string, cwd: string, logFile: string): { ok: boolean; output: string } {
  const result = spawnSync(command, {
    cwd,
    env: CHILD_ENV,
    shell: true,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: STEP_TIMEOUT_MS,
    maxBuffer: 256 * 1024 * 1024,
  });
  const timedOut = result.error && (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
  const output = `$ ${command}\n${result.stdout ?? ''}${result.stderr ?? ''}` +
    (timedOut ? `\n[e2e] TIMED OUT after ${STEP_TIMEOUT_MS / 60000} min\n` : '') +
    `\n[e2e] exit ${result.status}\n`;
  // eslint-disable-next-line no-control-regex -- strip ANSI colour codes from logs
  fs.outputFileSync(logFile, output.replace(/\x1b\[[0-9;]*m/g, ''));
  return { ok: result.status === 0, output };
}

function log(message: string): void {
  console.log(`[e2e ${new Date().toISOString().slice(11, 19)}] ${message}`);
}

async function copyProject(from: string, to: string): Promise<void> {
  const skipped = ['node_modules', '.next', 'dist'];
  await fs.copy(from, to, {
    filter: src => !path.relative(from, src).split(path.sep).some(part => skipped.includes(part)),
  });
}

/** Hash of every file under dir (node_modules excluded), by relative path */
async function hashTree(dir: string): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  const walk = async (current: string) => {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      const rel = path.relative(dir, full).split(path.sep).join('/');
      if (entry.isDirectory()) {
        hashes.set(`${rel}/`, 'dir');
        await walk(full);
      } else {
        hashes.set(rel, crypto.createHash('sha256').update(await fs.readFile(full)).digest('hex'));
      }
    }
  };
  await walk(dir);
  return hashes;
}

function diffTrees(before: Map<string, string>, after: Map<string, string>): string[] {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].filter(p => before.get(p) !== after.get(p)).sort();
}

async function runCase(framework: Framework, base: string, caseName: string, types: string[], outDir: string): Promise<CaseResult> {
  const config = FRAMEWORKS[framework];
  const dir = path.join(outDir, framework, caseName);
  const logs = path.join(outDir, 'logs', framework, caseName);
  await copyProject(base, dir);

  const result: CaseResult = {
    framework, name: caseName, add: types.length > 0 ? 'pass' : '-', addDetail: '', install: '-', typecheck: '-', build: '-', typeErrors: [],
  };

  // Expected refusal: `add` must fail and leave the project byte-for-byte unchanged
  if (types.length === 1 && config.refused.includes(canonical(types[0]))) {
    const before = await hashTree(dir);
    log(`${framework}/${caseName}: apix add ${types[0]} (must be refused)`);
    const add = run(`node "${APIX_BIN}" add ${types[0]} --name E2EToken --symbol ETOK`, dir, path.join(logs, `1-add-${types[0]}.log`));
    const changed = diffTrees(before, await hashTree(dir));
    if (add.ok) {
      result.add = 'FAIL';
      result.addDetail = 'expected a refusal, but add succeeded';
    } else if (changed.length > 0) {
      result.add = 'FAIL';
      result.addDetail = `refused, but changed: ${changed.join(', ')}`;
    } else {
      result.add = 'refused';
      const message = add.output.split('\n').find(line => line.includes(`Integration '`) && line.includes('failed:'));
      result.addDetail = `project unchanged; ${message ? message.replace(/\x1b\[[0-9;]*m/g, '').replace(/^.*failed: /, '') : 'refused'}`; // eslint-disable-line no-control-regex
    }
    return result;
  }

  const failedAdds: string[] = [];
  for (const type of types) {
    log(`${framework}/${caseName}: apix add ${type}`);
    // Symbol must be 2-6 uppercase letters
    const add = run(`node "${APIX_BIN}" add ${type} --name E2EToken --symbol ETOK`, dir, path.join(logs, `1-add-${type}.log`));
    if (!add.ok) failedAdds.push(type);
  }
  if (failedAdds.length > 0) {
    result.add = 'FAIL';
    result.addDetail = `failed: ${failedAdds.join(', ')}`;
  }

  // Keep going after a failed add: the remaining steps show what partial output does
  log(`${framework}/${caseName}: npm install`);
  result.install = run('npm install --no-audit --no-fund', dir, path.join(logs, '2-install.log')).ok ? 'pass' : 'FAIL';

  log(`${framework}/${caseName}: ${config.typecheck}`);
  const tsc = run(config.typecheck, dir, path.join(logs, '3-typecheck.log'));
  result.typecheck = tsc.ok ? 'pass' : 'FAIL';
  result.typeErrors = tsc.output.split('\n').filter(line => /error TS\d+/.test(line)).map(line => line.trim());

  log(`${framework}/${caseName}: ${config.build}`);
  result.build = run(config.build, dir, path.join(logs, '4-build.log')).ok ? 'pass' : 'FAIL';

  return result;
}

function printTable(results: CaseResult[]): void {
  const header = ['framework', 'case', 'add', 'install', 'typecheck', 'build', 'TS errors', 'notes'];
  const rows = results.map(r => [
    r.framework, r.name, r.add, r.install, r.typecheck, r.build, String(r.typeErrors.length), r.addDetail,
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map(row => row[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join(' | ');
  console.log(`\n${line(header)}\n${widths.map(w => '-'.repeat(w)).join('-|-')}`);
  rows.forEach(row => console.log(line(row)));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await fs.ensureDir(args.out);
  log(`output: ${args.out}`);

  if (args.buildApix) {
    log('building apix (npm run build)');
    if (!run('npm run build', REPO_ROOT, path.join(args.out, 'logs', 'apix-build.log')).ok) {
      throw new Error(`apix build failed, see ${path.join(args.out, 'logs', 'apix-build.log')}`);
    }
  }
  if (!await fs.pathExists(APIX_BIN)) {
    throw new Error(`${APIX_BIN} not found; run npm run build first`);
  }

  const allCases: Array<[string, string[]]> = [
    // Control: the untouched app must pass, so failures elsewhere are APIX's
    ['baseline', []],
    ...ADVERTISED_TYPES.map((type): [string, string[]] => [type, [type]]),
    // Every integration the framework supports, on one project
    ['all', []],
  ];
  const cases = allCases.filter(([name]) => !args.cases || args.cases.includes(name));

  const results: CaseResult[] = [];
  const resultsFile = path.join(args.out, 'results.json');
  let stopped = false;
  frameworks: for (const framework of args.frameworks) {
    // npm package names can't start with "_" or contain uppercase
    const baseName = 'base-app';
    const base = path.join(args.out, framework, baseName);
    await fs.ensureDir(path.dirname(base));
    log(`${framework}: scaffolding base app`);
    const scaffold = run(FRAMEWORKS[framework].scaffold(baseName), path.dirname(base), path.join(args.out, 'logs', framework, 'scaffold.log'));
    if (!scaffold.ok || !await fs.pathExists(path.join(base, 'package.json'))) {
      console.error(`[e2e] ${framework}: scaffolding failed, see logs/${framework}/scaffold.log; skipping`);
      continue;
    }
    await FRAMEWORKS[framework].postScaffold?.(base);
    for (const [name, types] of cases) {
      const freeMb = Math.round(os.freemem() / 1024 / 1024);
      if (freeMb < args.minFreeMb) {
        console.error(`[e2e] stopping before ${framework}/${name}: ${freeMb} MB free, need ${args.minFreeMb} MB (--min-free-mb)`);
        stopped = true;
        break frameworks;
      }
      log(`${framework}/${name}: starting (${freeMb} MB free)`);
      const caseTypes = name === 'all' ? INTEGRATIONS.filter(t => !FRAMEWORKS[framework].refused.includes(t)) : types;
      results.push(await runCase(framework, base, name, caseTypes, args.out));
      await fs.writeJSON(resultsFile, results, { spaces: 2 });
    }
  }

  await fs.writeJSON(resultsFile, results, { spaces: 2 });
  printTable(results);
  console.log(`\nLogs and generated projects: ${args.out}`);

  // 'refused' is a pass: the refusal was expected and the project unchanged
  const failed = results.some(r => [r.add, r.install, r.typecheck, r.build].includes('FAIL'));
  process.exit(failed || stopped || results.length === 0 ? 1 : 0);
}

main().catch(error => {
  console.error(`[e2e] ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
