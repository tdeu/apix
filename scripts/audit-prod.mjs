/**
 * Audit the dependency tree a user gets from `npm install -g apix-ai`.
 *
 * npm ignores this repository's lockfile on a user install, so the tree is
 * resolved fresh from package.json's dependencies and overrides, without the
 * development dependencies. This script rebuilds that tree in a temp directory
 * (lockfile only, nothing is downloaded or run) and audits it.
 *
 * Peer-only packages are left out (--omit=peer): @hashgraph/sdk pulls in
 * react-native as a peer of react-native-get-random-values, and nothing APIX
 * runs in Node loads it. See BACKLOG.md.
 *
 * Usage: npm run audit:prod
 * Exit code: the exit code of `npm audit` (non-zero on a high or critical
 * advisory), or 1 if the tree can't be resolved.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AUDIT_ARGS = ['audit', '--omit=dev', '--omit=peer', '--audit-level=high'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function npm(args, cwd, stdio) {
  // shell: npm is npm.cmd on Windows
  return spawnSync('npm', args, { cwd, stdio, shell: true, encoding: 'utf8' });
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apix-audit-prod-'));
let exitCode = 1;
try {
  const prodPkg = {
    name: pkg.name,
    version: pkg.version,
    engines: pkg.engines,
    dependencies: pkg.dependencies,
    overrides: pkg.overrides,
  };
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(prodPkg, null, 2));

  console.log(`Resolving the production tree of ${pkg.name}@${pkg.version} in ${dir}`);
  const install = npm(['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], dir, 'pipe');
  if (install.status !== 0) {
    console.error(install.stdout ?? '');
    console.error(install.stderr ?? '');
    throw new Error(`npm install --package-lock-only failed (exit ${install.status}); the production tree could not be resolved`);
  }

  console.log(`\n> npm ${AUDIT_ARGS.join(' ')}\n`);
  const audit = npm(AUDIT_ARGS, dir, 'inherit');
  if (audit.status === null) {
    throw new Error(`npm audit did not run: ${audit.error?.message ?? 'unknown error'}`);
  }
  exitCode = audit.status;

  const summary = npm([...AUDIT_ARGS, '--json'], dir, 'pipe');
  try {
    const v = JSON.parse(summary.stdout).metadata.vulnerabilities;
    console.log(
      `\nSeverity summary (production tree, peers omitted): ` +
        `critical ${v.critical}, high ${v.high}, moderate ${v.moderate}, low ${v.low}, info ${v.info}`
    );
  } catch {
    console.error('\nCould not read the severity summary from `npm audit --json`.');
    exitCode = exitCode || 1;
  }
  console.log(exitCode === 0 ? 'audit:prod passed: no high or critical advisory.' : `audit:prod failed (exit ${exitCode}).`);
} catch (error) {
  console.error(`audit:prod error: ${error.message}`);
  exitCode = 1;
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
process.exit(exitCode);
