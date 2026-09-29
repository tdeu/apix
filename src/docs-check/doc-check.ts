/**
 * Documentation checks, run by src/__tests__/docs.test.ts and by
 * `npm run check:docs` (scripts/check-docs.ts). Not shipped in the npm package.
 *   1. every `apix <command>` shown in README.md, CONTRIBUTING.md, docs/*.md
 *      (not docs/archive/) and the package.json "apix:*" scripts is a
 *      registered command, and every flag shown exists for it (or is a global
 *      option). CHANGELOG.md is left out: it names removed commands on purpose;
 *   2. every relative link in those files and in CHANGELOG.md resolves: the
 *      file exists, and a #fragment matches a heading in it.
 *
 * Commands and options are read statically from src/cli/index.ts, because
 * importing it runs the CLI.
 */
import fs from 'fs';
import path from 'path';

export const REPO_ROOT = path.resolve(__dirname, '..', '..');

export interface CliSpec {
  commands: Map<string, Set<string>>;
  globalFlags: Set<string>;
}

/** '-n, --name <n>' -> ['-n', '--name']; '--no-file-logging' also allows nothing else */
function flagsOf(spec: string): string[] {
  return spec.split(/[ ,|]+/).filter(part => /^--?[A-Za-z]/.test(part));
}

export function readCliSpec(source = fs.readFileSync(path.join(REPO_ROOT, 'src/cli/index.ts'), 'utf8')): CliSpec {
  const commands = new Map<string, Set<string>>();
  const globalFlags = new Set<string>(['-h', '--help', '-V', '--version']);

  // Each command is declared as `program\n  .command('name ...')` followed by
  // its .option() calls, up to the next `program` statement
  const blocks = source.split(/\nprogram\s*\n/);
  const header = blocks.shift() ?? '';
  for (const match of header.matchAll(/\.option\(\s*'([^']+)'/g)) {
    flagsOf(match[1]).forEach(flag => globalFlags.add(flag));
  }
  for (const block of blocks) {
    // A comment may precede .command(...)
    const command = block.match(/^(?:\s*\/\/[^\n]*\n)*\s*\.command\(\s*'([a-z-]+)/);
    if (!command) {
      // `program.option(...)` chains outside a command are global
      for (const match of block.matchAll(/^\s*\.option\(\s*'([^']+)'/gm)) {
        flagsOf(match[1]).forEach(flag => globalFlags.add(flag));
      }
      continue;
    }
    const flags = new Set<string>(['-h', '--help']);
    for (const match of block.matchAll(/\.option\(\s*'([^']+)'/g)) {
      flagsOf(match[1]).forEach(flag => flags.add(flag));
    }
    commands.set(command[1], flags);
  }
  commands.set('help', new Set(['-h', '--help']));
  return { commands, globalFlags };
}

export interface CommandUse {
  file: string;
  line: number;
  text: string;
}

/** Maintained docs: README, CONTRIBUTING, CHANGELOG and docs/*.md (not the archive) */
export function docFiles(root = REPO_ROOT): string[] {
  const docsDir = path.join(root, 'docs');
  return [
    ...['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md'].map(name => path.join(root, name)),
    ...fs.readdirSync(docsDir).filter(name => name.endsWith('.md')).map(name => path.join(docsDir, name)),
  ].filter(file => fs.existsSync(file));
}

/** Code spans and fenced code lines, with their line numbers */
function codeFragments(markdown: string): Array<{ line: number; text: string }> {
  const fragments: Array<{ line: number; text: string }> = [];
  let inFence = false;
  markdown.split('\n').forEach((raw, index) => {
    const line = index + 1;
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      fragments.push({ line, text: raw });
      return;
    }
    for (const span of raw.matchAll(/`([^`]+)`/g)) fragments.push({ line, text: span[1] });
  });
  return fragments;
}

/** Every `apix ...` invocation in the code of a Markdown file */
export function commandUses(file: string, markdown = fs.readFileSync(file, 'utf8')): CommandUse[] {
  const uses: CommandUse[] = [];
  for (const { line, text } of codeFragments(markdown)) {
    // "apix" as a command word: at the start or after whitespace, not a path
    // (github.com/.../apix), not `cd apix`, and followed by something
    for (const match of text.matchAll(/(?:^|[\s(])apix((?:\s+[^\s|;&`]+)+)/g)) {
      const before = text.slice(0, match.index ?? 0);
      if (/\bcd\s*$/.test(before)) continue;
      uses.push({ file, line, text: `apix${match[1]}`.trim() });
    }
  }
  return uses;
}

/** Problems with one invocation, or [] */
export function checkUse(use: CommandUse, spec: CliSpec): string[] {
  const tokens = use.text.split(/\s+/).slice(1);
  const where = `${path.relative(REPO_ROOT, use.file)}:${use.line} \`${use.text}\``;
  const first = tokens[0];
  if (!first || first.startsWith('<')) return []; // a placeholder like `apix <command>`

  let flags: Set<string>;
  let rest: string[];
  if (first.startsWith('-')) {
    flags = spec.globalFlags;
    rest = tokens;
  } else {
    const command = spec.commands.get(first);
    if (!command) return [`${where}: "${first}" is not an apix command`];
    flags = command;
    rest = tokens.slice(1);
  }

  const problems: string[] = [];
  for (const token of rest) {
    if (!token.startsWith('-')) continue;
    const flag = token.split('=')[0];
    if (!flags.has(flag) && !spec.globalFlags.has(flag)) {
      problems.push(`${where}: flag ${flag} does not exist${first.startsWith('-') ? '' : ` for "${first}"`}`);
    }
  }
  return problems;
}

/** `npm run apix -- <args>` in package.json scripts, as apix invocations */
export function scriptUses(root = REPO_ROOT): CommandUse[] {
  const file = path.join(root, 'package.json');
  const scripts: Record<string, string> = JSON.parse(fs.readFileSync(file, 'utf8')).scripts ?? {};
  return Object.entries(scripts)
    .map(([name, command]) => ({ name, match: command.match(/(?:npm run apix --|src\/cli\/index\.ts)\s+(.+)$/) }))
    .filter(entry => entry.match)
    .map(entry => ({ file, line: 0, text: `apix ${entry.match![1].replace(/'/g, '')}` }));
}

/** GitHub's heading anchors: lowercase, punctuation dropped, spaces to hyphens, duplicates numbered */
export function headingAnchors(markdown: string): Set<string> {
  const anchors = new Set<string>();
  const counts = new Map<string, number>();
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const heading = !inFence && line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;
    const base = heading[1]
      .replace(/`/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const seen = counts.get(base) ?? 0;
    anchors.add(seen === 0 ? base : `${base}-${seen}`);
    counts.set(base, seen + 1);
  }
  return anchors;
}

/** Relative links that don't resolve (missing file or heading) */
export function brokenLinks(file: string, markdown = fs.readFileSync(file, 'utf8')): string[] {
  const problems: string[] = [];
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  for (const match of withoutCode.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1];
    if (/^[a-z]+:/i.test(target) || target.startsWith('//')) continue; // http:, mailto:, ...
    const [linkPath, fragment] = target.split('#');
    const resolved = linkPath ? path.resolve(path.dirname(file), decodeURIComponent(linkPath)) : file;
    const where = `${path.relative(REPO_ROOT, file)}: ${target}`;
    if (!fs.existsSync(resolved)) {
      problems.push(`${where}: ${path.relative(REPO_ROOT, resolved)} does not exist`);
      continue;
    }
    if (fragment && resolved.endsWith('.md') && !headingAnchors(fs.readFileSync(resolved, 'utf8')).has(fragment)) {
      problems.push(`${where}: no heading #${fragment} in ${path.relative(REPO_ROOT, resolved)}`);
    }
  }
  return problems;
}

export function runDocChecks(root = REPO_ROOT): { commands: number; links: number; problems: string[] } {
  const spec = readCliSpec();
  const uses = [
    ...docFiles(root).filter(file => path.basename(file) !== 'CHANGELOG.md').flatMap(file => commandUses(file)),
    ...scriptUses(root),
  ];
  const linkProblems = docFiles(root).flatMap(file => brokenLinks(file));
  const links = docFiles(root).reduce(
    (count, file) => count + (fs.readFileSync(file, 'utf8').match(/\]\((?![a-z]+:)[^)\s]+\)/gi)?.length ?? 0),
    0
  );
  return {
    commands: uses.length,
    links,
    problems: [...uses.flatMap(use => checkUse(use, spec)), ...linkProblems],
  };
}

