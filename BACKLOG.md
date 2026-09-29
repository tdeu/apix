# APIX revival backlog

Out-of-scope findings go here instead of being fixed in the current phase.
See /CLAUDE.md for the working rules.

Tags: [blocker-2.1] a user following the README hits it, or an advertised
command is broken. [2.1-nice] fix if cheap. [post-2.1] new feature or deep
refactor.

## Phase 2 (dependencies)
- Phase 2: @hashgraph/hedera-wallet-snap removed (unused), 19e2bd0
- [post-2.1] Remaining advisories after Phase 2 (0 critical, 0 high): 6 moderate,
  15 low, all transitive under @hashgraph/sdk (bn.js, elliptic,
  @ethersproject/*, @hashgraph/cryptography), hedera-agent-kit (ai,
  @ai-sdk/*, @elizaos/core, langchain, crypto-browserify chain) and uuid 9.x.
  npm's suggested "fixes" are downgrades (sdk 2.72, agent-kit 3.7.1) or a
  uuid major (14). Revisit when upstream releases.
- [post-2.1] `package.json` overrides to drop once upstream catches up:
  `hedera-agent-kit > @langchain/core` (kit pins 1.1.24 but its langgraph needs
  >=1.1.48), `protobufjs` 7.6.6 and `@grpc/grpc-js` 1.12.7 (pinned by
  @hashgraph/sdk 2.80.0), `ethers > ws` (ethers now comes only from
  hedera-agent-kit), `@elizaos/core > pdfjs-dist`.
- Decision (Phase 2): the `@elizaos/core > pdfjs-dist` ^6 override is a forced
  major but is kept. It is unreachable from our code (hedera-agent-kit's main
  entry never loads @elizaos/core). Drop it when @elizaos/core updates
  pdfjs-dist itself.
- [post-2.1] `@hashgraph/sdk` 2.81.0 exists (moves to protobufjs 8) but
  hedera-agent-kit 3.8.2 pins 2.80.0. Move both together when the kit
  releases (and bump `HEDERA_SDK_VERSION_RANGE` with them).
- [post-2.1] `npm outdated` majors not taken (not security-driven): chalk 6,
  commander 15, inquirer 14, ora 9, openai 7, zod 4, uuid 14, dotenv 18,
  lru-cache 11, configstore 8, fuzzysort 4, typescript 7, jest 30, eslint 10,
  @types/node 26.

## Phase 3 (remove fake behaviour, fix app bugs)
- [blocker-2.1] The six AI commands (generate, recommend, explain, compare,
  confidence, debug) return fallbacks instead of erroring without a key.
  `generate` is to become AI-key-required; template-only generation goes
  through `add`. (Phase 3b.)
- BUG_REPORT_AND_FIXES.md open items:
  - [2.1-nice] #7 TODOs at `src/cli/cli-core.ts:1567,1575` (debug command
    file/log analysis, Phase 3b) and `src/planning/integration-planner.ts:429`
    ("Methods disabled due to syntax issues").
  - [2.1-nice] #9 5-second analyzer cache in `src/analysis/project-analyzer.ts`,
    no invalidation.
  - [2.1-nice] #12 `ENABLE_TELEMETRY` in `.env.example` is not implemented.
- Done in Phase 3a (Hedera side):
  - Test-account system removed; `initialize()` requires credentials and
    `add hts` makes no network call without credentials + confirmation or
    `--create-token` (83534eb).
  - Client leak on bad credentials fixed (83534eb).
  - InputSanitizer wired into every Hedera operation; the 3 category-B tests
    un-skipped (623b2a5).
  - Honest `apix health` by area, `--strict` (201ba0a, 1dc7878).
  - Generated projects pin `@hashgraph/sdk` to `^2.80.0`; `walletconnect`
    removed from generated provider types (4828c18).
  - `wallet-integration.ts` placeholder config removed (8318b80); delete/expose
    decision moved to Phase 5.
  - 10 category-C tests deleted, the 2 fallback tests rewritten, 0 skipped
    (3d648e2).
  - `validate` prints the credentials error once, without the trailing
    "Comprehensive validation failed:" line (phase 3a closeout).
- Done in Phase 3c step 2 (generation foundation):
  - Every template renders and loads; test renders all of them (b0ab215).
  - Output follows the project's layout (src/ vs root, App Router folder,
    tsconfig source root) with relative imports; a failed add leaves the
    project byte-for-byte unchanged (11523b8).
  - `add hts` / `add smart-contract` (Next.js) generate every module they
    import; lazy client, `server-only`, `'use client'` (1f3012c).
  - Templates match @hashgraph/sdk 2.80; sdk-compat test (f532214).
  - e2e (Next.js 16.3.6, no .env): baseline, hts and smart-contract pass
    install + type check + build.
- Found in Phase 3a, not fixed (outside its scope or needs a decision):
  - [done 3c] `apix add consensus` generates a working HCS integration
    (1d278d3); `apix add account` is refused, "not available in this
    version" (3a3432a; implementing it is post-2.1).
  - [2.1-nice] IntegrationGenerator ignores `TemplateSelection.variables`, so
    per-template planner variables (e.g. `walletTypes`) never reach the
    templates.
  - [2.1-nice] Generated wallet-service still lists `'metamask'` as a provider
    with no adapter (only HashPack and Blade are implemented).
  - [done 3c] Next steps list only what was generated (f31e665).
  - [2.1-nice] `validate` only checks local configuration (no network call; it
    now says so). `--testnet`/`--mainnet` are ignored (network comes from
    HEDERA_NETWORK), and `--enterprise/--performance/--security/--compliance`
    do nothing (now printed as not implemented). Decide: implement or remove.
  - [2.1-nice] APIX's own HederaOperationsService (src/services, not the
    templates): `createToken` ignores `treasuryAccount` (always the operator).
    `deploySmartContract` doesn't validate bytecode: decide the expected format
    first (`InputSanitizer.validateBytecode` wants a `0x` prefix, but the raw
    string goes to `FileCreateTransaction.setContents`). `createTopic`
    doesn't validate the memo (100-byte limit).
  - [2.1-nice] `InputSanitizer.validateTokenCreation` silently upper-cases
    symbols (`test` becomes `TEST`).
  - [post-2.1] `wallet-integration.ts` logs the WalletConnect project ID in
    full, and its dApp metadata uses hedera.com's URL and logo as APIX's
    identity. Resolve with the delete/expose decision (Phase 5).
  - [2.1-nice] The repo mixes CRLF and LF files with no `.gitattributes`.
    Git Bash `sed -i` rewrites CRLF files as LF. Consider normalising in
    Phase 5.

- Found in Phase 3c step 2, not fixed:
  - [done 3c] deployERC20Token() and all hard-coded bytecode removed; contract
    helpers take validated bytecode (57d1c50).
  - [done 3c] JavaScript projects are refused (3a3432a, now part of the
    support allowlist); supporting them is post-2.1.
  - [done 3c] TokenManager/routes: the operator is treasury and sender; the
    wallet is only shown and used as recipient (1dffb08).
  - [done 3c] https mirror node URLs are converted to host:443 (1dffb08).
  - [2.1-nice] `lib/hedera/{hts,smart-contract}-operations.ts` at the repo root
    are generated files committed by accident in 1aa9b5c (not compiled;
    tsconfig only includes src/). Delete. S.
  - [post-2.1] Pages Router: `add hts` and `add consensus` are refused cleanly
    (their routes are App Router only); wallet and smart-contract work. Pages
    Router API routes would be new templates. M.
  - [post-2.1] Token burn, associate and balances: hooks + routes were cut from
    useTokens (only create/info/mint/transfer are generated).
  - [post-2.1] Unused templates still use `@/` imports or APIs that don't match
    the generated modules: WalletContext, useWalletOperations,
    useTokensWithWallet, MobileWalletInterface, WalletConnectionModal,
    WalletConnectV2, TokenManagerEnhanced, api/adaptive, hts-wallet-operations,
    transaction-signer. Delete or wire up.
- Found in Phase 3c step 3, not fixed:
  - [2.1-nice] The validator's "template-conflicts" warning counts files that
    are byte-identical to what would be generated (the generator now skips
    those), so it overstates conflicts. S.
  - [2.1-nice] Existing-integration detection (project-analyzer) only looks at
    root paths (components/, lib/), so it never fires for src/ projects; the
    overwrite check is what protects files there. Align it with the
    detected layout or drop it. S.
  - [done 3c] `apix add` support is an allowlist: Next.js + TypeScript gets every
    integration, React/Vite + TypeScript gets wallet (experimental), anything
    else is refused naming the detected framework (phase 3c closeout).
  - [2.1-nice] The e2e CI job (ci.yml) and the nightly workflow have not run on
    GitHub yet; check the first PR run (timing, npm cache, artifact).
  - [2.1-nice] When `apix add` runs `npm install` and it fails, the user only
    sees "Command failed: npm install": PackageManager captures npm's output
    and drops it. Show npm's error (at least the last lines). S.

## Phase 4

## Phase 5 (docs, README, cleanup)
- [blocker-2.1] Confirm the Jest suite passes on Linux (GitHub Actions once
  enabled, or Docker node:22 with --runInBand --detectOpenHandles
  --forceExit). `npm ci` and `build:check` already pass on node:20 and
  node:22 (Linux). The Jest run stalled when the Docker engine failed, so the
  result is unknown.
- [blocker-2.1] README.md is stale and partly fake. It says "Works
  immediately with mock implementations". It advertises `apix
  create-test-account`, which doesn't exist, and "demo credentials". It lists
  testnet IDs (accounts, tokens, contract, topic) that APIX never created. It
  clones `github.com/tdeu/apix` and claims `apix --version` shows 2.0.0 and
  SDK v2.40.0.
- [2.1-nice] Rename `templates/components/react/WalletConnect.hbs` (e.g.
  `ConnectWallet.hbs`, and the `WalletConnect` component /
  `components/WalletConnect.tsx` output it generates) so it isn't confused
  with the WalletConnect protocol. It is a generic "connect your wallet" UI.
- [2.1-nice] Decide: delete `src/services/wallet-integration.ts`, or expose it
  as an `apix wallet` command (exposing it is [post-2.1]). It is unreachable
  from the CLI, and its HashPack/Blade paths use `window.*`, so only the
  WalletConnect v2 path can work in a terminal. Phase 3a removed its
  placeholder config (`getWalletConfig()` now throws when
  `WALLETCONNECT_PROJECT_ID` / `BLADE_DAPP_CODE` are missing).
- [post-2.1] ESLint rules downgraded to "warn" in `eslint.config.js` because
  of existing violations (counts at Phase 1; set each back to "error" once
  clean):
  - `@typescript-eslint/no-explicit-any`: 500
  - `@typescript-eslint/no-unused-vars`: 145 (4 in test files)
  - `@typescript-eslint/no-require-imports`: 14 (cli/index.ts, cli-core.ts,
    chat-interface.ts, conversation-engine.ts, hedera-agent-kit-service.ts,
    template-engine.ts)
  - `no-case-declarations`: 12 (ai-code-composition-engine.ts,
    file-generator.ts, input-sanitizer.ts)
  - `@typescript-eslint/no-this-alias`: 3 (template-engine.ts)
  - [2.1-nice] `no-async-promise-executor`: 2 (utils/progress.ts:300,324).
    Possible real bug: a throw inside an async executor does not reject the
    promise.
  - `no-control-regex`: 2 (status-line-manager.ts:389 ANSI stripping,
    input-sanitizer.ts:158 control-char removal). Both look intentional;
    use a targeted disable comment.
  - `no-useless-escape`: 1 (ai/recovery/error-recovery-system.ts:1314). `\s`
    in a string literal is just `s`; check whether a regex was intended.
  - `prefer-const`: 1 (validation/health-checker.ts:79)

## Post-2.1
- [post-2.1] Implement WalletConnect v2 in templates. Phase 3a removed
  `'walletconnect'` from the generated `WalletProvider` types
  (`templates/utils/common/wallet-service.hbs`, `templates/types/hedera-types.hbs`),
  `src/types` and the planner/validator provider lists because no template
  implemented it.
- [post-2.1] `apix add account`: refused in 2.1 ("not available in this
  version"). Implementing it means an AccountCreateTransaction utility and a
  server route (M).
- [post-2.1] JavaScript projects: every integration is refused in 2.1
  ("doesn't support <framework> with JavaScript"). Supporting them means real JS branches in the
  templates (several are stubs today) and .js/.jsx output paths (L).
- [post-2.1] Widen the `apix add` allowlist beyond Next.js: Vue, Angular,
  Express, plain Node and unknown projects are refused in 2.1. Each needs its
  own layout/route templates and an e2e harness framework (M-L each).
- [post-2.1] Plain React/Vite: hts, smart-contract and consensus are refused
  (they need a server to hold the operator key); wallet is allowed and marked
  experimental. Supporting the others needs a backend story (e.g. generated
  server functions) (L).

## Decisions
