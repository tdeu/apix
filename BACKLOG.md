# APIX revival backlog

Out-of-scope findings go here instead of being fixed in the current phase.
See /CLAUDE.md for the working rules.

## Phase 2 (dependencies)
- Phase 2: @hashgraph/hedera-wallet-snap removed (unused), 19e2bd0
- Remaining advisories after Phase 2 (0 critical, 0 high): 6 moderate,
  15 low, all transitive under @hashgraph/sdk (bn.js, elliptic,
  @ethersproject/*, @hashgraph/cryptography), hedera-agent-kit (ai,
  @ai-sdk/*, @elizaos/core, langchain, crypto-browserify chain) and uuid 9.x.
  npm's suggested "fixes" are downgrades (sdk 2.72, agent-kit 3.7.1) or a
  uuid major (14). Revisit when upstream releases.
- `package.json` overrides to drop once upstream catches up:
  `hedera-agent-kit > @langchain/core` (kit pins 1.1.24 but its langgraph needs
  >=1.1.48), `protobufjs` 7.6.6 and `@grpc/grpc-js` 1.12.7 (pinned by
  @hashgraph/sdk 2.80.0), `ethers > ws` (ethers now comes only from
  hedera-agent-kit), `@elizaos/core > pdfjs-dist`.
- Decision (Phase 2): the `@elizaos/core > pdfjs-dist` ^6 override is a forced
  major but is kept. It is unreachable from our code (hedera-agent-kit's main
  entry never loads @elizaos/core). Drop it when @elizaos/core updates
  pdfjs-dist itself.
- `@hashgraph/sdk` 2.81.0 exists (moves to protobufjs 8) but hedera-agent-kit
  3.8.2 pins 2.80.0. Move both together when the kit releases.
- `npm outdated` majors not taken (not security-driven): chalk 6, commander 15,
  inquirer 14, ora 9, openai 7, zod 4, uuid 14, dotenv 18, lru-cache 11,
  configstore 8, fuzzysort 4, typescript 7, jest 30, eslint 10, @types/node 26.

## Phase 3 (remove fake behaviour, fix app bugs)
- The six AI commands (generate, recommend, explain, compare, confidence,
  debug) return fallbacks instead of erroring without a key. `generate` is to
  become AI-key-required; template-only generation goes through `add`.
- BUG_REPORT_AND_FIXES.md open items:
  - #7 TODOs at `src/cli/cli-core.ts:1567,1575` and
    `src/planning/integration-planner.ts:429` ("Methods disabled due to syntax
    issues").
  - #9 5-second analyzer cache in `src/analysis/project-analyzer.ts`, no
    invalidation.
  - #12 `ENABLE_TELEMETRY` in `.env.example` is not implemented.
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
- Found in Phase 3a, not fixed (outside its scope or needs a decision):
  - Templates that fail to render (Handlebars parse errors):
    `api/adaptive/tokens/create` (line 47),
    `components/react/TokenManagerEnhanced` (line 21),
    `utils/common/hedera-client` (line 42). See
    `npm run snapshot:templates`.
  - TemplateEngine never loads `templates/types/hedera-types.hbs` or
    `templates/enterprise-variants/**`: it only reads `<category>/<framework>/`
    subdirectories of a fixed category list.
  - `apix add consensus` fails: the planner uses
    `utils/common/consensus-operations`, which doesn't exist. The `account`
    plan has no templates at all.
  - IntegrationGenerator ignores `TemplateSelection.variables`, so per-template
    planner variables (e.g. `walletTypes`) never reach the templates.
  - Generated wallet-service still lists `'metamask'` as a provider with no
    adapter (only HashPack and Blade are implemented).
  - `add` prints next steps for a README and tests that are never generated.
  - `validate` only checks local configuration (no network call; it now says
    so). `--testnet`/`--mainnet` are ignored (network comes from
    HEDERA_NETWORK), and `--enterprise/--performance/--security/--compliance`
    do nothing (now printed as not implemented). Decide: implement or remove.
  - `createToken` ignores `treasuryAccount` (always the operator).
    `deploySmartContract` doesn't validate bytecode: decide the expected format
    first (`InputSanitizer.validateBytecode` wants a `0x` prefix, but the raw
    string goes to `FileCreateTransaction.setContents`). `createTopic`
    doesn't validate the memo (100-byte limit).
  - `InputSanitizer.validateTokenCreation` silently upper-cases symbols
    (`test` becomes `TEST`).
  - `wallet-integration.ts` logs the WalletConnect project ID in full, and its
    dApp metadata uses hedera.com's URL and logo as APIX's identity.
  - The repo mixes CRLF and LF files with no `.gitattributes`. Git Bash
    `sed -i` rewrites CRLF files as LF. Consider normalising in Phase 5.

## Phase 4

## Phase 5 (docs, README, cleanup)
- Implement WalletConnect v2 in templates. Phase 3a removed `'walletconnect'`
  from the generated `WalletProvider` types (`templates/utils/common/wallet-service.hbs`,
  `templates/types/hedera-types.hbs`), `src/types` and the planner/validator
  provider lists because no template implemented it.
- Rename `templates/components/react/WalletConnect.hbs` (e.g. `ConnectWallet.hbs`,
  and the `WalletConnect` component/`components/WalletConnect.tsx` output it
  generates) so it isn't confused with the WalletConnect protocol. It is a
  generic "connect your wallet" UI.
- Decide: delete `src/services/wallet-integration.ts`, or expose it as an
  `apix wallet` command. It is unreachable from the CLI (only the removed
  health integration test used it), and its HashPack/Blade paths use
  `window.*`, so only the WalletConnect v2 path can work in a terminal. Phase 3a
  removed its placeholder config (`getWalletConfig()` now throws when
  `WALLETCONNECT_PROJECT_ID` / `BLADE_DAPP_CODE` are missing).
- ESLint rules downgraded to "warn" in `eslint.config.js` because of existing
  violations (counts at Phase 1; set each back to "error" once clean):
  - `@typescript-eslint/no-explicit-any`: 500
  - `@typescript-eslint/no-unused-vars`: 145 (4 in test files)
  - `@typescript-eslint/no-require-imports`: 14 (cli/index.ts, cli-core.ts,
    chat-interface.ts, conversation-engine.ts, hedera-agent-kit-service.ts,
    template-engine.ts)
  - `no-case-declarations`: 12 (ai-code-composition-engine.ts,
    file-generator.ts, input-sanitizer.ts)
  - `@typescript-eslint/no-this-alias`: 3 (template-engine.ts)
  - `no-async-promise-executor`: 2 (utils/progress.ts:300,324). Possible real
    bug: a throw inside an async executor does not reject the promise.
  - `no-control-regex`: 2 (status-line-manager.ts:389 ANSI stripping,
    input-sanitizer.ts:158 control-char removal). Both look intentional;
    use a targeted disable comment.
  - `no-useless-escape`: 1 (ai/recovery/error-recovery-system.ts:1314). `\s`
    in a string literal is just `s`; check whether a regex was intended.
  - `prefer-const`: 1 (validation/health-checker.ts:79)

## Decisions
