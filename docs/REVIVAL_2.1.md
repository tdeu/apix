# The 2.1 revival

This document explains what happened to APIX between the October 2025
hackathon build and 2.1.0, where things stand now, and what is left before
the release. It is written for someone who wasn't involved. The working
rules are in [CLAUDE.md](../CLAUDE.md), open items in
[BACKLOG.md](../BACKLOG.md), and the on-chain evidence in
[TESTNET_PROOF.md](TESTNET_PROOF.md).

## Why

The hackathon build (2.0.x, October–November 2025) overstated what worked:

- A simulation mode and test-account fallbacks made commands report success
  without touching Hedera.
- The README listed testnet accounts, tokens, a contract and a topic that
  were never created.
- The generated code did not compile in a fresh Next.js app (missing
  modules, wrong imports, an outdated SDK API).
- The AI commands returned canned replies when no API key was set.
- The error-recovery "retry" decided its outcome at random.

The documents from that time are kept, unmaintained, in
[docs/archive/](archive/README.md).

## What was done, per phase

Each phase has its own branch; each branch contains the previous one. They
are merged into `master` together, through one pull request.

| Phase | Branch | Head |
|---|---|---|
| 0 | `revive/2.1` | `ff06801` |
| 1 | `phase-1/tooling` | `80a5281` |
| 2 | `phase-2/deps` | `19e2bd0` |
| 3a | `phase-3a/hedera-honest` | `0fb03fc` |
| 3c | `phase-3c/working-generation` | `e682e05` |
| 3b | `phase-3b/ai-honest` | `ffac81a` |
| 4 | `phase-4/testnet-proof` | `5f8f1a0` |
| 4b | `phase-4b/testnet-fixes` | `4651e14` |
| 5a | `phase-5a/docs-release-prep` | this branch (the handover commit) |

- **Phase 0, housekeeping.** New working rules in CLAUDE.md ("never fake
  success", keys server-side only, secrets masked). The canonical repo is
  the fork, github.com/0xfishbone/apix.
- **Phase 1, tooling.** Made the Jest suite run, added an ESLint 9 flat
  config (existing violations downgraded to warnings), started BACKLOG.md,
  and added a CI workflow (build, tests, gitleaks).
- **Phase 2, dependencies.** Pinned `@hashgraph/sdk` 2.80.0, updated
  LangChain and hedera-agent-kit, and fixed or overrode vulnerable packages,
  down to 0 critical and 0 high advisories in production dependencies. An
  `npm audit` gate was added to CI.
- **Phase 3a, honest Hedera side.**
  - Removed the test-account fallback; Hedera commands now require real
    credentials.
  - Every input is validated before a network call, and `apix health`
    reports honestly, area by area.
  - Added a template snapshot script to prove template changes.
- **Phase 3c, working generation.** (Done before 3b.)
  - Every template renders.
  - Output follows the project's layout with relative imports, and every
    imported module is generated.
  - The templates match SDK 2.80, and there is a working HCS integration.
  - A support allowlist, and no overwrites without `--force` (with rollback
    on failure).
  - An e2e harness that installs, type-checks and builds the result.
- **Phase 3b, honest AI side.**
  - No canned replies: AI commands without a key exit 1 with a clear
    message.
  - One provider selector (Anthropic, then OpenAI), using the official SDKs,
    with model IDs in one place.
  - Error recovery is diagnosis only; `compose` is experimental.
  - Groq and telemetry settings removed; secrets masked in all output.
- **Phase 4, testnet proof.** A proof script (`npm run proof:testnet`), the
  evidence document and a nightly smoke workflow. It found real bugs:
  - token creation through hedera-agent-kit lost the token ID;
  - contract calls didn't encode their arguments;
  - there was no mint or contract read;
  - generated token creation without `maxSupply` failed.
- **Phase 4b, fixes and re-proof.**
  - Tokens are created with the SDK, and every operation needs an ID from
    the receipt.
  - Contract calls are ABI-encoded, with a `queryContract` read, plus
    `mintToken`.
  - Generated tokens are INFINITE unless capped, and HashScan links are
    correct.
  - Mainnet spending needs a confirmation.
  - Everything was re-proven on testnet.
- **Phase 5a, docs and release prep.**
  - README rewritten from the evidence; guides, CONTRIBUTING, CHANGELOG and
    LICENSE; hackathon docs archived.
  - 2.1.0 packaging (71 files), and a test that docs only show real
    commands, flags and links.
  - Removed: `deploy`, 31 flags that did nothing, hedera-agent-kit,
    LangChain, dead code, 12 unused templates and 12 unused dependencies.
  - Generated apps pinned to `~2.80.0`, and the library proof re-run.

## Key decisions

- **The fork is canonical** (github.com/0xfishbone/apix): that's where the
  revival lives and where the release will come from.
- **Next.js App Router + TypeScript only** (a support allowlist). It's the
  one stack that is tested end to end. React/Vite gets `wallet` only
  (experimental), and everything else is refused with a message instead of
  getting broken code.
- **Relative imports in generated code**, so the output works whatever path
  aliases the project uses.
- **`import 'server-only'` in generated Hedera modules**, so the build fails
  if client code imports them, and the private key can't reach the browser.
- **The operator signs everything in 2.1.** One server-side account is
  treasury, supply key and sender. A connected wallet is only displayed and
  used as a recipient; wallet signing is post-2.1.
- **`compose` behind `--experimental`**: it lists AI-composed files but
  doesn't write them, so it isn't presented as a finished feature.
- **One AI provider selector**: Anthropic if `ANTHROPIC_API_KEY` is set,
  otherwise OpenAI. There's no silent failover, and a failed request is an
  error.
- **No automatic retry**: nothing APIX diagnoses can be re-run safely, and
  the old retry was random. `apix debug` only suggests what to try.
- **hedera-agent-kit and LangChain removed**: the kit lost token IDs and
  ignored options, and nothing needed LangChain. Removing both cut the
  production audit advisories from 21 to 11 and production packages from 610
  to 415.
- **`@hashgraph/sdk` pinned to 2.80.0, with `~2.80.0` in generated apps**,
  so generated code uses the version that was tested on testnet (a caret
  range had started resolving to an untested 2.81.0).
- **`deploy` and 31 flags removed**: they did nothing real, and each is
  listed in [CHANGELOG.md](../CHANGELOG.md).

## Evidence

[TESTNET_PROOF.md](TESTNET_PROOF.md) records every operation with its
entity ID, transaction ID, HashScan link and a mirror-node check:

- **Library** (latest run, SDK 2.80.0): token create, mint and transfer;
  a topic with two messages; a Solidity contract deployed, `set` called and
  `get` read back. 9/9 steps mirror-verified.
- **CLI**: `apix create-token` created a token with admin and supply keys,
  and printed its real ID and links.
- **Generated Next.js apps**: the create, info, mint, transfer, topic and
  message routes, plus the generated contract module (deploy, set, get).
  All ran on testnet under `next start`.
- **Observed fees** (testnet): token create about 13 ℏ, contract deploy
  about 15 ℏ, messages and mints well under 0.1 ℏ.
- **Honest history**: what Phase 4 found broken and how 4b fixed it.

## How to verify locally

You need Node.js 20+ and git. For the testnet proof, you also need **your
own** testnet account from [portal.hedera.com](https://portal.hedera.com/faucet)
(its account ID and DER-encoded private key).

```bash
git clone https://github.com/0xfishbone/apix.git
cd apix
npm ci
npm run build:check
npm run lint
npm run check:docs

# Tests, one file at a time (the whole suite at once can run out of memory)
for f in $(find src -path "*__tests__*" -name "*.ts" | sort); do npx jest --runInBand "$f" || break; done

# Generated-code e2e: scaffold Next.js apps, add each integration, install, type-check, build
npm run e2e:generate -- --framework next --case baseline,hts --min-free-mb 1536
```

`--min-free-mb` stops the harness before a case when free memory is low,
because on Windows low memory makes processes fail to start and the results
meaningless. `--framework all` runs every framework and case.

Testnet proof: create `.env` at the repo root (git-ignored):

```bash
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=302e...
APIX_DEMO_RECIPIENT=0.0.yyyyy
```

`APIX_DEMO_RECIPIENT` is a second testnet account with automatic token
associations, to receive the transfer. Then run:

```bash
npm run proof:testnet
```

It refuses to run unless `HEDERA_NETWORK=testnet`. It spends about 29
testnet HBAR, exits 1 if any step fails, and writes
`docs/testnet-proof.json`.

## Current state

| Check | Result (end of Phase 5a) |
|---|---|
| Build | `build:check` passes |
| Lint | 0 errors, 409 warnings (tracked in BACKLOG) |
| Tests | 26 test files, 246 tests, all passing (run one file at a time on Windows) |
| Docs check | Every `apix` command, flag and relative link in the docs is real |
| `npm audit --omit=dev` | 11 advisories: 7 low, 4 moderate, 0 high, 0 critical (transitive under `@hashgraph/sdk`, plus uuid) |
| npm package | 71 files, 162.7 kB |
| Testnet | Library proof 9/9 on SDK 2.80.0 |

Not verified yet:

- **CI has never run**, because GitHub Actions isn't enabled on the repo.
  The workflows exist (`.github/workflows/`) but have produced no results.
- **Jest and the e2e harness on Linux**: everything above was run on a
  Windows laptop.
- **The full e2e matrix**: the Pages Router and Vite frameworks and every
  case. Locally, the Next.js cases were run in Phase 3c and `hts` again in
  Phase 5a.
- **The Vite wallet case** (the experimental React/Vite `wallet`
  integration).
- **The default OpenAI model** (`gpt-4o-mini`), because no OpenAI key was
  available.
- **Other gaps:**
  - The CLI and generated-app testnet rows are from Phases 4 and 4b and were
    not re-run after the Phase 5a cleanup (the templates are byte-identical).
  - The browser wallet flow and WalletConnect were never exercised.
  - Mainnet was never touched.

## Release checklist

In order:

1. **Enable GitHub Actions** on the repo. *Who:* the repo owner.
2. **Add the repo secrets** `HEDERA_ACCOUNT_ID` and `HEDERA_PRIVATE_KEY`,
   from any testnet account (ideally a dedicated one), for the nightly
   testnet smoke. *Who:* the repo owner.
3. **Get CI green on master**: merge this pull request, then re-run the
   workflows or push. That covers Jest on Linux, the audit gate, gitleaks
   and the e2e job. *Who:* the repo owner, or anyone with write access.
4. **Publish 2.1.0 to npm.** An npm owner of `apix-ai` adds maintainers if
   needed (`npm owner add <user> apix-ai`), then runs `npm publish` from
   `master`. Check `npm pack --dry-run` first. *Who:* an npm owner of
   `apix-ai`.
5. **Create the GitHub release** `v2.1.0` from the CHANGELOG entry. *Who:*
   the repo owner, or anyone with write access.
6. **Make the repository public.** *Who:* the repo owner.
7. **Fill in the placeholders**: `DISCORD_INVITE_URL` in README.md, the
   release date of the 2.1.0 entry in CHANGELOG.md, and the "until 2.1.0 is
   published" notes in README.md and docs/getting-started.md. *Who:* anyone
   with write access.

Before or alongside this, see the [blocker-2.1] items in
[BACKLOG.md](../BACKLOG.md). Verifying the OpenAI model needs someone with an
OpenAI key.

## Pointers

- [BACKLOG.md](../BACKLOG.md): open items, grouped as [blocker-2.1],
  [2.1-nice] and [post-2.1], plus the history of each phase.
- [CLAUDE.md](../CLAUDE.md): the working rules. Read these before changing
  anything.
- [CONTRIBUTING.md](../CONTRIBUTING.md): branches, gates, the e2e harness
  and the testnet proof.
- [CHANGELOG.md](../CHANGELOG.md): what changed in 2.1.0, item by item.
- [README.md](../README.md) and the guides in [docs/](getting-started.md)
  for users.
