/**
 * npm run check:docs: the documentation checks from src/docs-check/doc-check.ts
 * (also run by src/__tests__/docs.test.ts).
 */
import { runDocChecks } from '../src/docs-check/doc-check';

const { commands, links, problems } = runDocChecks();
if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problem(s) in the docs.`);
  process.exit(1);
}
console.log(`Docs OK: ${commands} apix invocations and ${links} relative links checked.`);
