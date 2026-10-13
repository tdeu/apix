# Contributing

## Ground rules

The working rules are in [CLAUDE.md](CLAUDE.md). The most important one is
**never fake success**: no mock responses, random outcomes, simulated
transactions or fallback accounts. A real failure is an error with a clear,
actionable message. Private keys only ever appear in server-side generated
code, and secrets are never printed in full.

## Branches and pull requests

- `master` is the default branch and only changes through pull requests.
- Work on a branch (e.g. `fix/token-supply`), with conventional commit
  messages (`fix:`, `feat:`, `docs:`, `chore:` and so on).
- Keep each pull request to one topic. Things you notice outside it belong
  in [BACKLOG.md](BACKLOG.md).

## Before you commit

These must pass (CI runs them on Node 20 and 22):

```bash
npm run build:check
npm run lint        # 0 errors; warnings are tracked in BACKLOG.md
npm test
```

On a machine with little free memory, run the tests one file at a time:
`npx jest --runInBand <file>`.

CI also runs `npm run audit:prod` and checks that `apix --version` matches
`package.json`. `audit:prod` (scripts/audit-prod.mjs) packs the tarball,
installs it globally into a temp prefix the way a user's npm does, and
fails on a high or critical advisory in what ends up on disk. `npm audit
--omit=dev` on the repository's own tree also runs, but doesn't block.

The published package ships an `npm-shrinkwrap.json`, because `overrides`
in `package.json` don't apply to a user's install. The tree it pins is kept
in `npm-shrinkwrap.release.json` (production dependencies only, overrides
applied, no auto-installed peers); `prepack` copies it into place and
`postpack` removes it. After changing a dependency, an override or the
version, run `npm run shrinkwrap` and commit the result: `npm pack` refuses
to run when it is out of date.

## Generated-code e2e harness

`scripts/e2e-generate.ts` scaffolds a fresh app, runs `apix add` for each
integration, then installs, type-checks and builds the result:

```bash
npm run e2e:generate -- --framework next --case baseline,hts
```

- `--framework`: `next`, `next-pages`, `vite` or `all`.
- `--case`: `baseline`, an integration name, or `all`.
- `--out <dir>`: where the apps and logs go.
- `--no-build-apix`: skip rebuilding APIX first.
- `--min-free-mb <n>` (default 1536): stop before a case when free memory
  is below `n` MB. On Windows, low memory makes processes fail to start and
  the results meaningless.

Pull requests run the Next.js baseline and "all" cases; a nightly workflow
runs every case.

## Testnet proof

`npm run proof:testnet` runs APIX's own Hedera operations on **testnet**
(token create, mint and transfer, a topic with messages, a contract deploy,
call and read) and checks each result on the mirror node. It writes
`docs/testnet-proof.json` and exits 1 if any step fails. It refuses to run
unless `HEDERA_NETWORK=testnet`.

It reads `.env` at the repo root:

```bash
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=302e...
APIX_DEMO_RECIPIENT=0.0.yyyyy   # an account with automatic token associations
```

A full run spends about 29 testnet HBAR (free from the
[faucet](https://portal.hedera.com/faucet)). Update
[docs/TESTNET_PROOF.md](docs/TESTNET_PROOF.md) when the results change.

## Nightly testnet smoke

`.github/workflows/testnet-smoke.yml` runs `npm run proof:testnet -- --smoke`
nightly and on manual dispatch: it creates a token and a topic and submits a
message. It needs the repository secrets `HEDERA_ACCOUNT_ID` and
`HEDERA_PRIVATE_KEY` (use a dedicated testnet account), and it skips cleanly
when they aren't set.

## Documentation

User docs are [README.md](README.md) and the guides in [docs/](docs). A
test checks that every `apix` command and flag they show exists, and that
their relative links resolve. Documents in [docs/archive/](docs/archive) are
kept for history only and are not maintained.
