# APIX revival backlog

Out-of-scope findings go here instead of being fixed in the current phase.
See /CLAUDE.md for the working rules.

## Phase 2 (dependencies)
- Remaining advisories after Phase 2 (0 critical, 0 high): 15 moderate,
  15 low, all transitive under @hashgraph/sdk (bn.js, elliptic,
  @ethersproject/*, @hashgraph/cryptography), hedera-agent-kit (ai,
  @ai-sdk/*, @elizaos/core, langchain, crypto-browserify chain),
  @hashgraph/hedera-wallet-snap (@metamask/*) and uuid 9.x. npm's suggested
  "fixes" are downgrades (sdk 2.72, agent-kit 3.7.1, wallet-snap 0.4.2) or a
  uuid major (14). Revisit when upstream releases.
- `package.json` overrides to drop once upstream catches up:
  `hedera-agent-kit > @langchain/core` (kit pins 1.1.24 but its langgraph needs
  >=1.1.48), `protobufjs` 7.6.6 and `@grpc/grpc-js` 1.12.7 (pinned by
  @hashgraph/sdk 2.80.0), `ethers > ws`, `@elizaos/core > pdfjs-dist`.
- `@hashgraph/sdk` 2.81.0 exists (moves to protobufjs 8) but hedera-agent-kit
  3.8.2 pins 2.80.0. Move both together when the kit releases.
- `@hashgraph/hedera-wallet-snap` is a dependency but is never imported (the
  code only uses the snap ID string). Removing it drops ethers and the
  7 @metamask/* moderate advisories. Needs a decision (see Decisions).
- `npm outdated` majors not taken (not security-driven): chalk 6, commander 15,
  inquirer 14, ora 9, openai 7, zod 4, uuid 14, dotenv 18, lru-cache 11,
  configstore 8, fuzzysort 4, typescript 7, jest 30, eslint 10, @types/node 26.

## Phase 3 (remove fake behaviour, fix app bugs)
- The six AI commands (generate, recommend, explain, compare, confidence,
  debug) return fallbacks instead of erroring without a key. `generate` is to
  become AI-key-required; template-only generation goes through `add`.
- BUG_REPORT_AND_FIXES.md open items:
  - #7 TODOs at `src/cli/cli-core.ts:1610,1618` and
    `src/planning/integration-planner.ts:428` ("Methods disabled due to syntax
    issues").
  - #9 5-second analyzer cache in `src/analysis/project-analyzer.ts`, no
    invalidation.
  - #12 `ENABLE_TELEMETRY` in `.env.example` is not implemented.
- Remove `src/utils/test-accounts.ts` and the test-account fallback in
  `src/services/hedera-operations.ts`.
- Delete the 10 tests in `src/services/__tests__/hedera-operations.test.ts`
  marked `SKIP(phase-3): asserts fake behaviour` (simulated token/contract/topic
  operations and test-account fallback). Also revisit two passing tests that
  encode fallback behaviour: "should report capabilities" (expects a
  `testAccounts` capability) and "should close client connections" (expects
  `isFallbackMode()` to be true after close, contradicting its own comment).
- `createToken` / `transferToken` do not validate input: `InputSanitizer`
  (`src/utils/input-sanitizer.ts`) exists but is not wired in. Three tests are
  skipped with `SKIP(phase-3)` until it is (empty token name, token symbol
  format, account ID format).
- `HederaOperationsService.initializeWithCredentials()` creates a `Client` and
  does not close it when `setOperator()` throws on bad credentials, leaking
  network timers (found because it kept jest from exiting).
- `src/utils/test-accounts.ts` opens a Hedera `Client` at import time
  (module-level `testAccountManager` singleton). Goes away with the file.
- `apix add hts --name X --symbol Y` without credentials goes through the
  test-account fallback and makes a real testnet network attempt before
  printing "Token creation prompt failed".
- The code generator writes `"@hashgraph/sdk": "latest"` (and any other plan
  dependency as "latest") into the user's package.json
  (`src/generation/integration-generator.ts:52`). Generated projects are
  unpinned; should pin to the version APIX is tested against.
- `src/services/wallet-integration.ts` is unreachable from the CLI (no `wallet`
  command; only `health` calls `getSupportedWallets()`), and its HashPack/Blade
  paths use `window.*`, so they can't work in a terminal. `getDefaultConfig()`
  (~line 1190) still returns placeholder project IDs/dApp codes. Decide whether
  to wire up a `wallet` command or delete the service.
- Generated wallet code lists `'walletconnect'` as a provider type but
  implements no WalletConnect connection.

## Phase 4

## Phase 5 (docs, README, cleanup)
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
