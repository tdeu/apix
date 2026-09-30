// The maintained docs only show commands and flags that exist, and their
// relative links resolve (src/docs-check/doc-check.ts; also `npm run check:docs`)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { brokenLinks, checkUse, commandUses, headingAnchors, readCliSpec, runDocChecks } from '../docs-check/doc-check';

describe('documentation', () => {
  it('shows only real commands and flags, and has no broken relative links', () => {
    const { commands, links, problems } = runDocChecks();
    expect(problems).toEqual([]);
    // Guard against the checks silently finding nothing
    expect(commands).toBeGreaterThan(40);
    expect(links).toBeGreaterThan(20);
  });

  describe('the checker itself', () => {
    const spec = readCliSpec();

    it('reads the registered commands and their flags from the CLI source', () => {
      expect(spec.commands.get('add')).toEqual(expect.objectContaining({}));
      expect(spec.commands.get('add')!.has('--create-token')).toBe(true);
      expect(spec.commands.get('create-token')!.has('--max-supply')).toBe(true);
      expect(spec.commands.get('compose')!.has('--experimental')).toBe(true);
      expect(spec.commands.has('deploy')).toBe(false);
      expect(spec.globalFlags.has('--debug')).toBe(true);
    });

    it('reports an unknown command, an unknown flag, a missing file and a missing heading', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apix-docs-'));
      try {
        fs.writeFileSync(path.join(dir, 'other.md'), '# Real heading\n');
        const file = path.join(dir, 'doc.md');
        const markdown = [
          '# Title',
          '',
          'Run `apix deploy --environment prod` or `apix validate --testnet`.',
          '',
          '```bash',
          'apix add hts --create-token --yes',
          'cd apix',
          '```',
          '',
          '[ok](other.md#real-heading) [gone](missing.md) [bad anchor](other.md#nope) [site](https://example.com)',
        ].join('\n');
        fs.writeFileSync(file, markdown);

        const uses = commandUses(file);
        expect(uses.map(use => use.text)).toEqual([
          'apix deploy --environment prod',
          'apix validate --testnet',
          'apix add hts --create-token --yes',
        ]);
        const problems = uses.flatMap(use => checkUse(use, spec));
        expect(problems).toHaveLength(2);
        expect(problems[0]).toMatch(/"deploy" is not an apix command/);
        expect(problems[1]).toMatch(/flag --testnet does not exist for "validate"/);

        const links = brokenLinks(file);
        expect(links).toHaveLength(2);
        expect(links[0]).toMatch(/missing\.md does not exist/);
        expect(links[1]).toMatch(/no heading #nope/);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('builds heading anchors the way GitHub does', () => {
      const anchors = headingAnchors('# Timings (Phase 4, one run, about 1.2 GB)\n## `apix add` errors\n## Setup\n## Setup\n');
      expect([...anchors]).toEqual(['timings-phase-4-one-run-about-12-gb', 'apix-add-errors', 'setup', 'setup-1']);
    });
  });
});
