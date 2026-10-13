/**
 * The npm-shrinkwrap.json that ships in the published package.
 *
 * Why: package.json `overrides` do not apply when APIX is installed as a
 * dependency or globally, so without a shrinkwrap users get whatever npm
 * resolves (unpatched protobufjs and @grpc/grpc-js), plus react-native as an
 * auto-installed peer of react-native-get-random-values, which APIX never
 * loads in Node. A shrinkwrap in the tarball pins the tree users install.
 *
 * The shipped tree is kept in npm-shrinkwrap.release.json, not in
 * npm-shrinkwrap.json: a root npm-shrinkwrap.json would replace
 * package-lock.json for development installs, and it has no development
 * dependencies. `prepack` copies it into place and `postpack` removes it.
 *
 * Usage:
 *   npm run shrinkwrap             regenerate npm-shrinkwrap.release.json from
 *                                  package.json and package-lock.json (run it
 *                                  after changing a dependency or the version)
 *   node scripts/shrinkwrap.mjs stage     (prepack) check it and copy it to npm-shrinkwrap.json
 *   node scripts/shrinkwrap.mjs unstage   (postpack) remove npm-shrinkwrap.json
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Peer-only packages that must not be in what users install (see BACKLOG.md)
const FORBIDDEN = ['react-native', 'metro', 'braces'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE = path.join(root, 'npm-shrinkwrap.release.json');
const STAGED = path.join(root, 'npm-shrinkwrap.json');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const pkg = readJson(path.join(root, 'package.json'));

/** Fails unless the release shrinkwrap matches package.json and has none of the forbidden packages. */
function check(lock) {
  const problems = [];
  const self = lock.packages?.[''] ?? {};
  if (lock.name !== pkg.name || self.name !== pkg.name) problems.push(`name is ${self.name}, package.json says ${pkg.name}`);
  if (lock.version !== pkg.version || self.version !== pkg.version) problems.push(`version is ${self.version}, package.json says ${pkg.version}`);
  if (JSON.stringify(self.dependencies ?? {}) !== JSON.stringify(pkg.dependencies ?? {})) problems.push('dependencies differ from package.json');
  for (const [name, version] of Object.entries(pkg.overrides ?? {})) {
    const entries = Object.entries(lock.packages).filter(([location]) => location.endsWith(`node_modules/${name}`));
    for (const [location, entry] of entries) {
      if (entry.version !== version) problems.push(`${location} is ${entry.version}, the override says ${version}`);
    }
  }
  for (const name of FORBIDDEN) {
    const hits = Object.keys(lock.packages).filter(location => location.endsWith(`node_modules/${name}`));
    if (hits.length > 0) problems.push(`${name} is in the tree (${hits.join(', ')})`);
  }
  const dev = Object.entries(lock.packages).filter(([, entry]) => entry.dev || entry.peer);
  if (dev.length > 0) problems.push(`${dev.length} development or peer-only packages are in the tree`);
  if (problems.length > 0) {
    throw new Error(`npm-shrinkwrap.release.json is out of date or wrong:\n  - ${problems.join('\n  - ')}\nRun: npm run shrinkwrap`);
  }
}

function generate() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apix-shrinkwrap-'));
  try {
    // The production side of package.json, resolved from the committed
    // lockfile so users get the versions the tests ran against. The overrides
    // apply here because this is the root project. --legacy-peer-deps leaves
    // out auto-installed peers (react-native and everything behind it).
    const prodPkg = { name: pkg.name, version: pkg.version, engines: pkg.engines, dependencies: pkg.dependencies, overrides: pkg.overrides };
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(prodPkg, null, 2));
    fs.copyFileSync(path.join(root, 'package-lock.json'), path.join(dir, 'package-lock.json'));
    const install = spawnSync(
      'npm',
      ['install', '--package-lock-only', '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund'],
      { cwd: dir, stdio: 'pipe', shell: true, encoding: 'utf8' } // shell: npm is npm.cmd on Windows
    );
    if (install.status !== 0) {
      console.error(install.stdout ?? '');
      console.error(install.stderr ?? '');
      throw new Error(`npm install --package-lock-only failed (exit ${install.status})`);
    }
    const lock = readJson(path.join(dir, 'package-lock.json'));
    check(lock);
    fs.writeFileSync(RELEASE, JSON.stringify(lock, null, 2) + '\n');
    console.log(`Wrote ${path.basename(RELEASE)}: ${Object.keys(lock.packages).length - 1} packages`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

try {
  const mode = process.argv[2] ?? 'generate';
  if (mode === 'generate') {
    generate();
  } else if (mode === 'stage') {
    check(readJson(RELEASE));
    fs.copyFileSync(RELEASE, STAGED);
  } else if (mode === 'unstage') {
    fs.rmSync(STAGED, { force: true });
  } else {
    throw new Error(`Unknown mode "${mode}". Use generate, stage or unstage.`);
  }
} catch (error) {
  console.error(`shrinkwrap: ${error.message}`);
  process.exit(1);
}
