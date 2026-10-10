# APIX revival backlog

Out-of-scope findings go here instead of being fixed in the current phase.
See /CLAUDE.md for the working rules.

Tags: [2.1.x] should be fixed in a patch release. [2.1-nice] fix if cheap.
[post-2.1] new feature or deep refactor. Sizes: S, M, L. The [blocker-2.1]
items that gated the 2.1.0 release are closed or carried over below; see
"Release" under Done.

## Open

### [2.1.x] After the 2.1.0 release

2.1.0 was published to npm on 2026-09-30. What is still open, as checked on
2026-10-10 (master `474a45f`):

- [2.1.x] **New advisories.** `npm audit --omit=dev` now reports 2 critical
  and 9 high advisories, all published after the release (the audit gate
  passed in CI on 2026-09-30): `handlebars` <= 4.7.9, a direct dependency
  (critical, e.g. GHSA-xw65-4hp5-5hc7 and GHSA-8r5x-fm3f-whwj);
  `shell-quote` 1.8.4 to 1.10.0 (critical, GHSA-pqg4-j6r4-53mv); and
  `braces` <= 3.0.3 (high, GHSA-vfj7-8cjw-p6xm), which npm also reports on
  micromatch, metro and react-native. npm says a fix is available for each.
  Until this is fixed, CI's audit gate (`--audit-level=high`) fails on every
  pull request and push. *Who:* anyone, by PR. S-M.
- [2.1.x] **Vite wallet fails the type-check.** The nightly e2e workflow
  (`--framework all`) has failed every night from 2026-10-01 to 2026-10-09
  on 2 of its 27 cases, `vite/wallet` and `vite/all`: 6 TS6133 errors in the
  generated `src/lib/hedera/wallet-service.ts` (unused imports `Client`,
  `AccountId`, `PrivateKey`, `TransactionId` and `Hbar`, and an unused
  `accountId` parameter) under the Vite template's `noUnusedLocals`.
  Install and `vite build` pass. Every other case passes or is refused as
  designed. Fix the template, or drop Vite from the support matrix in
  README.md and docs/integrations.md. *Who:* anyone, by PR. S.
- [2.1.x] **Testnet smoke secrets.** The `HEDERA_ACCOUNT_ID` /
  `HEDERA_PRIVATE_KEY` repo secrets are not set, so the nightly testnet
  smoke reports success while skipping every step. Add them (a dedicated
  testnet account) and check the first real run. *Who:* the repo owner.
- [2.1.x] **OpenAI model.** The default OpenAI model `gpt-4o-mini`
  (`src/ai/models.ts`, override `APIX_OPENAI_MODEL`) is still unverified. A
  retired ID breaks every AI command for OpenAI-only users. *Who:* anyone
  with an OpenAI key (run e.g. `apix explain "What is HTS?"` with only
  `OPENAI_API_KEY` set).
- [2.1.x] **Release housekeeping.**
  - Tag `v2.1.0` at `474a45f` and create the GitHub release. *Who:* anyone
    with write access.
  - Publish 2.1.1 (docs only) after its pull request is merged. *Who:* an
    npm owner of `apix-ai` (only 0xfishbone today).
  - Make the repository public: the npm page links to it, and it is still
    private. *Who:* the repo owner.
  - Close the seven per-phase draft pull requests (#1 to #7), which are
    all included in #8. *Who:* anyone with write access.
  - Discord: there is no invite link yet, so the Community section was
    removed from README.md. Add it back with a real link. *Who:* the team.

### [2.1-nice]

CLI and repo:
- `add hts --create-token` creates 1,000,000 tokens at 8 decimals; it takes
  `--name`/`--symbol` but no supply or decimals flags. S.
- Decide: keep or delete `scripts/test-with-claude.ts` (`npm run test:claude`)
  and `scripts/test-cli.sh`, old dev helpers that still run.
- Repo owner: delete the stale branch `hackathon-readme-updates` (fully
  contained in master).
- The repo mixes CRLF and LF files with no `.gitattributes`.
- ESLint: 409 warnings (0 errors) at 2.1.0; `no-async-promise-executor`
  in `utils/progress.ts` (2) is a possible real bug.

Health and analysis:
- `apix health`'s "wallet-integration" check looks for
  `src/services/wallet-integration.ts` in the user's project (APIX's own old
  path, not the generated `lib/hedera/wallet-service.ts`) and lists
  providers by string matching (it can report WalletConnect and MetaMask).
  Point it at the generated file and the working providers, or drop it. S.
- Existing-integration detection (project-analyzer) only looks at root paths
  (components/, lib/), so `apix analyze` recommends `add hts` in a src/ app
  that already has it (seen in the Phase 5a smoke). S.
- The validator's "template-conflicts" warning counts files that are
  byte-identical to what would be generated, which the generator skips. S.
- A 5-second analyzer cache with no invalidation
  (`src/analysis/project-analyzer.ts`).

Generation:
- IntegrationGenerator ignores `TemplateSelection.variables`, so planner
  variables never reach the templates.
- The generated wallet-service type lists `'metamask'` with no adapter (only
  HashPack and Blade are implemented).
- The generated `deployContract` defaults to 100000 gas. The testnet proof
  needed 400000 for an 861-byte contract; raise the default or require
  `gas`. S.
- The template engine silently falls back to a basic context if
  TemplateEnhancer throws (`src/templates/template-engine.ts`); make it an
  error or prove the output is identical. S.

AI:
- The "fast" model tier (`claude-haiku-4-5-20251001`,
  `APIX_ANTHROPIC_FAST_MODEL`) exists, but every engine uses the default
  tier. Use it or remove it. S.
- `chat` confidence is a hard-coded 0.8, so the chat "Confidence" line never
  shows. Drop it or compute it. S.
- `confidence` "Estimated Time" is a rule of thumb from the score (labelled
  as such). Drop it or ask the AI. S.

Library and inputs:
- `hedera-operations.createTopic` doesn't validate the memo (100-byte limit).
- `InputSanitizer.validateTokenCreation` silently upper-cases symbols.

### [post-2.1]

- A real `deploy` command. `apix deploy` was removed in 2.1 because it
  submitted no transaction.
- `compose` (experimental) lists composed files without writing or printing
  them, discards the AI's architecture design (`parseArchitectureDesign`
  returns `{}`) and reads options no flag sets. Decide: write with `add`'s
  overwrite protection, print, or remove. M.
- `apix add account` (AccountCreateTransaction utility and a server route). M.
- Pages Router API routes for `hts` and `consensus`. M.
- JavaScript projects (real JS template branches and .js/.jsx outputs). L.
- More frameworks: Vue, Angular, Express, plain Node (layout and route
  templates plus an e2e harness each). M-L each.
- React/Vite server-side integrations (they need a backend for the operator
  key). L.
- WalletConnect v2 in the generated wallet code.
- Token burn, associate and balance hooks and routes in the generated HTS
  code (the module has the methods).
- Unused templates with `@/` imports or APIs that don't match the generated
  modules: WalletContext, useWalletOperations, useTokensWithWallet,
  MobileWalletInterface, WalletConnectionModal, WalletConnectV2,
  TokenManagerEnhanced, api/adaptive, hts-wallet-operations (which also
  defaults to a FINITE supply without a max), transaction-signer. Delete or
  wire up.
- Opt-in telemetry: off by default and documented.
- Dependencies:
  - Remaining advisories at 2.1.0 (the newer critical and high ones are
    under [2.1.x] above): 4 moderate and 7 low, transitive under @hashgraph/sdk (@ethersproject/*, elliptic, bn.js,
    @hashgraph/cryptography) plus uuid 9.x. npm's suggested fixes are
    downgrades.
  - Drop the `protobufjs` / `@grpc/grpc-js` overrides when @hashgraph/sdk
    catches up (without them: 1 critical, 2 high).
  - Move APIX itself to `@hashgraph/sdk` 2.81 (nothing pins it to 2.80 now
    that hedera-agent-kit is gone).
  - Majors not taken (chalk 6, commander 15, inquirer 14, ora 9, openai 7,
    zod 4, uuid 14, dotenv 18, typescript 7, jest 30, eslint 10, ...).
- ESLint rules downgraded to "warn" in `eslint.config.js` (counts at
  Phase 1): no-explicit-any 500, no-unused-vars 145, no-require-imports 14,
  no-case-declarations 12, no-this-alias 3, no-control-regex 2 (both
  intentional), prefer-const 1. Set each back to "error" once clean.

## Done (history)

- **Phase 2 (dependencies):** production dependencies patched to 0 critical
  and 0 high advisories; LangChain 1.x; `@hashgraph/sdk` 2.80.0; unused
  wallet-snap removed; CI with build, tests, `npm audit` and gitleaks.
  Decision: the `@elizaos/core > pdfjs-dist` override is a forced major but
  unreachable from our code; drop it when @elizaos/core updates.
- **Phase 3a (Hedera side):** test-account fallback removed; credentials
  required; inputs validated before any SDK call; honest `apix health` by
  area with `--strict`; generated projects pin `@hashgraph/sdk` (now `~2.80.0`);
  fake-behaviour tests replaced.
- **Phase 3c (generation):** every template renders; output follows the
  project's layout with relative imports; every imported module is
  generated; working HCS integration; support allowlist; no overwrites
  without `--force`, with rollback on failure; npm's own error shown; next
  steps list only what was generated; the e2e harness runs in CI.
- **Phase 3b (AI):** AI commands need a key and never return canned
  replies; one provider module (Anthropic, then OpenAI) with current models;
  error recovery is diagnosis only; compose is experimental; Groq and
  telemetry settings removed; secrets masked everywhere.
- **Phase 4 / 4b (testnet):** `docs/TESTNET_PROOF.md`; token creation off
  hedera-agent-kit; every result carries a receipt ID; contract calls
  encoded and readable; mint added; generated tokens are INFINITE without
  `maxSupply`; correct HashScan links; mainnet confirmation; hedera-agent-kit
  no longer initialised; nightly testnet smoke.
- **Phase 5a (docs and release prep):**
  - `deploy` and validate's no-op flags removed;
  - `WalletConnect` component renamed `ConnectWallet`;
  - fake testnet IDs removed outside the archive;
  - README rewritten from the evidence;
  - docs consolidated into guides plus `docs/archive/`;
  - CONTRIBUTING, CHANGELOG and LICENSE;
  - version 2.1.0 with a `files` allowlist;
  - doc checks (commands, flags, links) in the test suite;
  - the stray root `lib/hedera/` deleted;
  - hedera-agent-kit and LangChain removed (audit 21 -> 11, 0 high/critical);
  - dead code, 12 unused templates and 12 unused dependencies removed
    (the four integrations' output byte-identical);
  - legacy scripts and `.env.example` variables removed;
  - 31 flags that did nothing removed, the working ones documented;
  - LICENSE holder confirmed (Emtée Studio);
  - `.claude/settings.local.json` untracked and git-ignored (the local file
    stays); handover in docs/REVIVAL_2.1.md;
  - generated `@hashgraph/sdk` range aligned to `~2.80.0` (was `^2.80.0`, which
    resolved to 2.81.0) and the library proof re-run on 2.80.0.
- **Release (2026-09-30):**
  - PR #8 merged by 0xfishbone as a merge commit (`aef91c7`), unchanged;
  - PR #9 (`474a45f`): `@grpc/grpc-js` override raised to 1.13.6, and the
    overrides written into generated apps;
  - `apix-ai@2.1.0` published to npm from `474a45f` by 0xfishbone;
  - GitHub Actions enabled, and CI green on `474a45f`: build, lint, Jest and
    the audit gate on Linux with Node 20 and 22, plus gitleaks. That closed
    the "GitHub Actions", "Jest on Linux" and "npm access and publish"
    blockers. The "Full e2e matrix" blocker ran and found the Vite wallet
    failure listed under Open.
