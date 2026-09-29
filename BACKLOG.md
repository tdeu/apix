# APIX revival backlog

Out-of-scope findings go here instead of being fixed in the current phase.
See /CLAUDE.md for the working rules.

Tags: [blocker-2.1] must happen before 2.1.0 is released. [2.1-nice] fix if
cheap. [post-2.1] new feature or deep refactor. Sizes: S, M, L.

## Open

### [blocker-2.1] Release steps

- [blocker-2.1] **Jest on Linux.** Confirm the suite passes on Linux: the CI
  workflow runs it on Node 20 and 22 on the first pull request to `master`.
  `npm ci` and `build:check` already passed on Linux; the Jest run never
  completed there (the local Docker engine failed).
- [blocker-2.1] **Full e2e matrix.** Run `npm run e2e:generate -- --framework all`
  green (the nightly e2e workflow does this on GitHub; it hasn't run yet).
  Check the first run's timing, npm cache and log artifact.
- [blocker-2.1] **Vite wallet.** Confirm the experimental `wallet` case on
  React/Vite + TypeScript installs, type-checks and builds (part of the e2e
  matrix), or drop Vite from the support matrix in README.md and
  docs/integrations.md.
- [blocker-2.1] **OpenAI model.** Verify the default OpenAI model
  `gpt-4o-mini` (`src/ai/models.ts`, override `APIX_OPENAI_MODEL`) is still
  offered. A retired ID breaks every AI command for OpenAI-only users. It is
  unverified because no OpenAI key was available.
- [blocker-2.1] **hedera-agent-kit decision.** Decide removal of
  hedera-agent-kit, pending the Hedera milestone clause. It is no longer
  initialised and no operation uses it; the package stays in
  `package.json`, and `src/validation/agent-kit/hedera-validator-simple.ts`
  imports it (reached only from the unused
  `src/testing/comprehensive-test-suite.ts`). Removing it would also drop
  its `package.json` overrides and most of the remaining audit advisories.
- [blocker-2.1] **npm access and publish.** Confirm who can publish
  `apix-ai` (npm still serves 2.0.3). At release: replace
  `DISCORD_INVITE_URL` in README.md, date the 2.1.0 entry in CHANGELOG.md,
  update the "install from source" note in README.md and
  docs/getting-started.md, and check the `npm pack --dry-run` file list (92
  files at the end of Phase 5a).

### [2.1-nice]

CLI honesty and cleanup:
- Declared flags whose effect is unverified. The docs only show verified
  flags, so check or remove these: `generate --validate-live`,
  `--custom-logic`, `--integration-type`, `--framework`; `debug
  --suggest-fixes`, `--files`, `--logs` (the last two are printed as not
  supported); `recommend --budget`, `--timeline`, `--interactive`; `add
  --provider`, `--type`; `explain --detailed`, `--examples`,
  `--regulations`. S-M.
- Dead code in the npm package: `dist/testing/` (the unused
  comprehensive-test-suite), `dist/validation/agent-kit/`, and unused
  templates (`templates/api/adaptive/`, `templates/enterprise-variants/`).
  Delete it, or exclude it in `files`. S.
- Old dev scripts in `scripts/` (`test-workflow.js`, `demo-verify.js`,
  `setup-apix.js`, `test-all-apix.sh`, `test-cli.sh`, `test-with-claude.ts`)
  are unverified, and some reference removed file names. Delete or fix. S.
- `.env.example` still lists variables nothing reads: `ENABLE_DEBUG_LOGGING`,
  `CLI_INTERACTIVE_MODE`, `CLI_PROGRESS_INDICATORS`, `CLI_COLOR_OUTPUT`, and
  the "enterprise security" ones (`ENCRYPTION_KEY`, `JWT_SECRET`). S.
- `add hts --create-token` creates 1,000,000 tokens at 8 decimals with no
  name, supply or decimals flags of its own. S.
- The nightly testnet smoke hasn't run on GitHub: add the
  `HEDERA_ACCOUNT_ID` / `HEDERA_PRIVATE_KEY` repo secrets (a dedicated
  testnet account) and check the first run.
- Confirm the LICENSE copyright holder (Phase 5a used `package.json`'s
  author, "Emtée Studio").

AI:
- The "fast" model tier (`claude-haiku-4-5-20251001`,
  `APIX_ANTHROPIC_FAST_MODEL`) exists, but every engine uses the default
  tier. Use it or remove it. S.
- `chat` confidence is a hard-coded 0.8, so the chat "Confidence" line never
  shows. Drop it or compute it. S.
- `confidence` "Estimated Time" is a rule of thumb from the score (labelled
  as such). Drop it or ask the AI. S.

Generation and analysis:
- IntegrationGenerator ignores `TemplateSelection.variables`, so planner
  variables (e.g. `walletTypes`) never reach the templates.
- The generated wallet-service lists `'metamask'` as a provider with no
  adapter (only HashPack and Blade are implemented).
- The validator's "template-conflicts" warning counts files that are
  byte-identical to what would be generated, which the generator skips. S.
- Existing-integration detection (project-analyzer) only looks at root paths
  (components/, lib/), so it never fires for src/ projects. S.
- The generated `deployContract` defaults to 100000 gas. The testnet proof
  needed 400000 for an 861-byte contract; raise the default or require
  `gas`. S.
- A TODO at `src/planning/integration-planner.ts` ("Methods disabled due to
  syntax issues"); a 5-second analyzer cache with no invalidation
  (`src/analysis/project-analyzer.ts`).

Library and inputs:
- `hedera-operations.createTopic` doesn't validate the memo (100-byte limit).
- `InputSanitizer.validateTokenCreation` silently upper-cases symbols.

Repo:
- The repo mixes CRLF and LF files with no `.gitattributes`.
- Decide: delete `src/services/wallet-integration.ts`, or expose it as an
  `apix wallet` command ([post-2.1]). It is unreachable from the CLI.
- ESLint `no-async-promise-executor` in `utils/progress.ts` (2): a throw
  inside an async executor doesn't reject the promise.

### [post-2.1]

- A real `deploy` command. `apix deploy` was removed in 2.1 because it
  submitted no transaction.
- `compose` (experimental) lists composed files without writing or printing
  them, discards the AI's architecture design (`parseArchitectureDesign`
  returns `{}`), reads options no flag sets, and declares unused flags
  (`--templates`, `--novel-pattern`, `--validate-live`). Decide: write with
  `add`'s overwrite protection, print, or remove. M.
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
- `wallet-integration.ts` logs the WalletConnect project ID in full and uses
  hedera.com's URL and logo as APIX's identity (decide with its delete/expose
  item).
- Opt-in telemetry: off by default and documented.
- Dependencies:
  - Remaining advisories: 0 critical, 0 high; 6 moderate and 15 low, all
    transitive under @hashgraph/sdk and hedera-agent-kit, plus uuid 9.x.
    npm's suggested fixes are downgrades.
  - Drop `package.json` overrides when upstream catches up.
  - Move to `@hashgraph/sdk` 2.81 together with hedera-agent-kit (or after
    removing it), and bump `HEDERA_SDK_VERSION_RANGE`.
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
  area with `--strict`; generated projects pin `@hashgraph/sdk ^2.80.0`;
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
  - the stray root `lib/hedera/` deleted.
