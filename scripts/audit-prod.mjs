/**
 * Audit what a user actually gets from `npm install -g apix-hedera`.
 *
 * Packs this repository (`npm pack`, which builds it), installs the tarball
 * globally into a temp prefix through a stand-in registry, exactly as a user's
 * npm would, and runs `npm audit` on the packages that ended up on disk.
 *
 * Why a real install: package.json `overrides` only apply when the package is
 * the root project, not when it is installed as a dependency or globally. What
 * users get is decided by the published tarball (its npm-shrinkwrap.json) and
 * by their npm, so that is what this script looks at.
 *
 * Why a stand-in registry: npm only honours a dependency's npm-shrinkwrap.json
 * when the registry metadata says `_hasShrinkwrap: true`, which the npm
 * registry sets when the published tarball contains one. `npm install -g
 * <tarball>` has no such metadata and ignores the shrinkwrap, so it would not
 * show what a user gets. The registry here serves this package from the packed
 * tarball, with `_hasShrinkwrap` read from the tarball as npmjs.org does, and
 * redirects every other request to registry.npmjs.org.
 *
 * Usage: npm run audit:prod
 * Exit code: the exit code of `npm audit` (non-zero on a high or critical
 * advisory), or 1 if packing or installing fails.
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const AUDIT_ARGS = ['audit', '--omit=dev', '--audit-level=high'];
// Reported after the install: heavy or unpatched packages we keep out of it,
// the package our override pins (ws) and the SDK's other advisory-prone deps
const WATCHED = ['react-native', 'metro', 'braces', 'protobufjs', '@grpc/grpc-js', 'ws'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const quote = args => args.map(arg => (arg.includes(' ') ? `"${arg}"` : arg));

function npm(args, cwd, stdio) {
  // shell: npm is npm.cmd on Windows
  return spawnSync('npm', quote(args), { cwd, stdio, shell: true, encoding: 'utf8' });
}

function run(what, args, cwd) {
  const result = npm(args, cwd, 'pipe');
  if (result.status !== 0) {
    console.error(result.stdout ?? '');
    console.error(result.stderr ?? '');
    throw new Error(`${what} failed (exit ${result.status})`);
  }
  return result;
}

/** npm, without blocking the event loop (the registry below has to answer while it runs) */
function runAsync(what, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', quote(args), { cwd, shell: true });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) return resolve(output);
      console.error(output);
      reject(new Error(`${what} failed (exit ${code})`));
    });
  });
}

/** Does the .tgz contain package/npm-shrinkwrap.json? (what the npm registry checks at publish time) */
function tarballHasShrinkwrap(tarball) {
  const tar = zlib.gunzipSync(tarball);
  for (let offset = 0; offset + 512 <= tar.length;) {
    const end = tar.indexOf(0, offset);
    const name = tar.toString('utf8', offset, Math.min(end, offset + 100));
    if (!name) break;
    if (name === 'package/npm-shrinkwrap.json') return true;
    const size = parseInt(tar.toString('utf8', offset + 124, offset + 136), 8) || 0;
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return false;
}

/** A registry that serves this package from the packed tarball and redirects everything else to npmjs.org */
function startRegistry(tarballPath) {
  const tarball = fs.readFileSync(tarballPath);
  const hasShrinkwrap = tarballHasShrinkwrap(tarball);
  const tarballRoute = `/${pkg.name}/-/${path.basename(tarballPath)}`;
  const server = http.createServer((request, response) => {
    const route = decodeURIComponent(request.url.split('?')[0]);
    if (route === `/${pkg.name}`) {
      const origin = `http://127.0.0.1:${server.address().port}`;
      const version = {
        ...pkg,
        _id: `${pkg.name}@${pkg.version}`,
        _hasShrinkwrap: hasShrinkwrap,
        dist: {
          tarball: origin + tarballRoute,
          integrity: `sha512-${crypto.createHash('sha512').update(tarball).digest('base64')}`,
          shasum: crypto.createHash('sha1').update(tarball).digest('hex'),
        },
      };
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ name: pkg.name, 'dist-tags': { latest: pkg.version }, versions: { [pkg.version]: version } }));
    } else if (route === tarballRoute) {
      response.writeHead(200, { 'content-type': 'application/octet-stream' });
      response.end(tarball);
    } else {
      response.writeHead(307, { location: `https://registry.npmjs.org${request.url}` });
      response.end();
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, hasShrinkwrap })));
}

/** name -> versions of every package installed under dir/node_modules, nested ones included */
function installedPackages(dir, found = new Map()) {
  const modules = path.join(dir, 'node_modules');
  if (!fs.existsSync(modules)) return found;
  for (const entry of fs.readdirSync(modules)) {
    if (entry.startsWith('.')) continue;
    const dirs = entry.startsWith('@')
      ? fs.readdirSync(path.join(modules, entry)).map(name => path.join(modules, entry, name))
      : [path.join(modules, entry)];
    for (const packageDir of dirs) {
      const manifest = path.join(packageDir, 'package.json');
      if (!fs.existsSync(manifest)) continue;
      const { name, version } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      found.set(name, [...(found.get(name) ?? []), version]);
      installedPackages(packageDir, found);
    }
  }
  return found;
}

// APIX_AUDIT_KEEP=<empty dir>: work there and leave the install in place, to
// run more checks against it (e.g. APIX_PROOF_ROOT of scripts/testnet-proof.ts)
const keep = process.env.APIX_AUDIT_KEEP ? path.resolve(process.env.APIX_AUDIT_KEEP) : undefined;
if (keep) fs.mkdirSync(keep, { recursive: true });
const dir = keep ?? fs.mkdtempSync(path.join(os.tmpdir(), 'apix-audit-prod-'));
let exitCode = 1;
try {
  console.log(`Packing ${pkg.name}@${pkg.version}`);
  run('npm pack', ['pack', '--pack-destination', dir], root);
  const tarball = fs.readdirSync(dir).find(file => file.endsWith('.tgz'));
  if (!tarball) throw new Error('npm pack produced no tarball');

  const prefix = path.join(dir, 'prefix');
  fs.mkdirSync(prefix);
  const { server, hasShrinkwrap } = await startRegistry(path.join(dir, tarball));
  const registry = `http://127.0.0.1:${server.address().port}/`;
  console.log(`Installing ${pkg.name}@${pkg.version} globally into ${prefix} (tarball has a shrinkwrap: ${hasShrinkwrap ? 'yes' : 'no'})`);
  try {
    await runAsync('npm install -g', ['install', '-g', `${pkg.name}@${pkg.version}`, '--registry', registry, '--prefix', prefix, '--no-audit', '--no-fund'], dir);
  } finally {
    server.close();
  }

  // <prefix>/lib/node_modules on POSIX, <prefix>/node_modules on Windows
  const installed = [path.join(prefix, 'lib', 'node_modules', pkg.name), path.join(prefix, 'node_modules', pkg.name)]
    .find(candidate => fs.existsSync(path.join(candidate, 'package.json')));
  if (!installed) throw new Error(`${pkg.name} was not found under ${prefix} after the install`);

  const packages = installedPackages(installed);
  const count = [...packages.values()].reduce((sum, versions) => sum + versions.length, 0);
  console.log(`\nInstalled tree: ${count} packages${keep ? ` in ${installed}` : ''}`);
  for (const name of WATCHED) console.log(`  ${name}: ${packages.get(name)?.join(', ') ?? 'not installed'}`);

  // Audit what is on disk, not what the tarball's shrinkwrap says should be
  // there: drop any shipped lockfile and record the installed tree instead
  for (const lock of ['npm-shrinkwrap.json', 'package-lock.json']) fs.rmSync(path.join(installed, lock), { force: true });
  run('npm shrinkwrap', ['shrinkwrap'], installed);

  console.log(`\n> npm ${AUDIT_ARGS.join(' ')}\n`);
  const audit = npm(AUDIT_ARGS, installed, 'inherit');
  if (audit.status === null) {
    throw new Error(`npm audit did not run: ${audit.error?.message ?? 'unknown error'}`);
  }
  exitCode = audit.status;

  const summary = npm([...AUDIT_ARGS, '--json'], installed, 'pipe');
  try {
    const v = JSON.parse(summary.stdout).metadata.vulnerabilities;
    console.log(
      `\nSeverity summary (installed tree): ` +
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
  if (!keep) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
process.exit(exitCode);
