# APIX revival backlog

Out-of-scope findings go here instead of being fixed in the current phase.
See /CLAUDE.md for the working rules.

## Phase 2 (dependencies)

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

## Phase 4

## Phase 5 (docs, README, cleanup)

## Decisions
