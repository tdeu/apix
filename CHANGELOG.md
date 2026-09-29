# Changelog

## 2.1.0 (Unreleased)

The revival release. Every Hedera operation APIX performs or generates was
run on testnet and verified on the mirror node
([docs/TESTNET_PROOF.md](docs/TESTNET_PROOF.md)).

### Added

- `apix add consensus` (alias `hcs`) generates a working HCS integration:
  topic and message routes with input checks.
- `apix add` checks support before writing anything. Next.js (App Router,
  TypeScript) is supported, React/Vite with TypeScript gets `wallet` only
  (experimental), and everything else is refused with a message.
- `apix add` never overwrites a file that differs from what it would
  generate unless you pass `--force`. A failed add (including a failed
  `npm install`, whose own output is shown) leaves the project exactly as it
  was.
- `apix create-token`: `--max-supply`, and HashScan links for the token and
  the transaction.
- Mainnet confirmation: `create-token` and `add hts --create-token` ask
  before spending HBAR on mainnet; `--yes` skips the question, and with no
  terminal they refuse without it.
- Library (`hedera-operations`): `mintToken`, `queryContract` (decoded
  view-function results), and ABI-encoded arguments for contract calls and
  constructors.
- A shared AI provider: Anthropic or OpenAI, with the models set in one
  place and overridable (`APIX_ANTHROPIC_MODEL`,
  `APIX_ANTHROPIC_FAST_MODEL`, `APIX_OPENAI_MODEL`).
- `apix health` reports by area; `--strict` exits 1 unless every area is ok.
- `npm run proof:testnet` (testnet proof script), a nightly testnet smoke
  workflow, a generation e2e harness (`npm run e2e:generate`) run in CI, and
  CI for build, lint, tests and `npm audit`.
- Docs: getting started, commands, integrations, troubleshooting,
  CONTRIBUTING, and the testnet evidence with observed fees.

### Changed

- Generated code installs, type-checks and builds in a fresh Next.js app.
  It follows the project's layout (with or without `src/`) with relative
  imports, generates every module it imports, and matches
  `@hashgraph/sdk` 2.80 (generated projects pin `^2.80.0`).
- Generated server modules import `server-only` and create the Hedera
  client on first use, so the private key stays on the server and
  `next build` needs no credentials. The operator signs every transaction;
  a connected wallet is only shown and used as a transfer recipient.
- Generated token creation uses an INFINITE supply unless `maxSupply` is
  given.
- Token creation in the CLI and library uses APIX's own
  TokenCreateTransaction: initial supply in the smallest unit, and key flags
  that set the operator key. Every operation takes its IDs from the
  network's receipt.
- `apix generate` classifies the requirement with the AI, then writes the
  same files as `apix add`.
- `compose` is experimental: hidden from `--help` unless
  `APIX_EXPERIMENTAL=1`, and it runs only with `--experimental`.
- The wallet component is `ConnectWallet` (`components/ConnectWallet.tsx`),
  not to be confused with the WalletConnect protocol.
- Default AI models: `claude-sonnet-5` (Anthropic), `gpt-4o-mini` (OpenAI,
  unverified).
- Hackathon-era documents moved to `docs/archive/`.

### Removed

- The test-account fallback, simulation leftovers, mock data and canned AI
  replies. Commands fail with a clear error instead.
- `apix deploy` (it submitted no transaction).
- `validate --enterprise/--performance/--security/--compliance/--testnet/--mainnet/--files`
  and `create-token --testnet/--mainnet`: they did nothing. The network comes
  from `HEDERA_NETWORK`.
- 28 more flags that no code path read:
  - `add --provider/--type`;
  - `generate --regulation/--business-context/--business-goals/--integration-type/--framework/--custom-logic/--validate-live`;
  - `recommend --business-goals/--current-systems/--regulations/--budget/--timeline/--interactive`;
  - `explain --detailed/--examples/--regulations`;
  - `compare --use-case/--criteria`;
  - `confidence --industry/--complexity`;
  - `debug --files/--logs/--suggest-fixes`;
  - `compose --templates/--novel-pattern/--validate-live`.

  Also the global `--json` (output was not JSON), `--log-file` (the path
  was never used) and `--no-file-logging` (never took effect).
- The error-recovery "retry", which decided outcomes at random. `apix debug`
  is diagnosis only.
- Groq, telemetry and every other variable APIX doesn't read from
  `.env.example`; each remaining variable has a one-line comment.
- Hackathon-era dev scripts: `scripts/setup-apix.js` (a v1 bootstrap that
  overwrote package.json), `demo-verify.js`, `test-workflow.js` (superseded
  by the e2e harness) and `test-all-apix.sh` (ran every command unattended,
  including token creation).
- Hard-coded contract bytecode and the fake contract deploy.
- hedera-agent-kit and LangChain (`@langchain/core`, `@langchain/anthropic`,
  `@langchain/openai`): nothing needed them once token creation used the
  SDK directly, and APIX's prompt templates are its own few lines of code.
  This removed 10 of the 21 production audit advisories and about 195
  production packages.
- Unused dependencies: `@hashgraph/hedera-wallet-snap`,
  `@walletconnect/sign-client`, `@walletconnect/utils`, `qrcode-terminal`,
  `axios`, `lodash`, `lru-cache`, `terminal-kit`, `tsconfig-paths` and their
  `@types` packages.
- Dead code that no command reached: APIX's own wallet-connection service
  (`src/services/wallet-integration.ts`), performance and security
  "managers", a second file generator, a template verifier, 17 planner
  methods and 13 package-manager methods nothing called, and 12 templates no
  integration renders. The generated files are byte-identical.
- The testnet IDs published with the hackathon submission, which were never
  created.

### Fixed

- Token creation through hedera-agent-kit reported success without a token
  ID and ignored the requested supply and keys. Tokens are now created with
  the SDK, and the kit was removed.
- `callSmartContract` sent no function data, so calls reverted.
- Generated token creation without `maxSupply` failed with
  `INVALID_TOKEN_MAX_SUPPLY`.
- Next steps after `apix add` list only what was generated.
- HashScan links point to the right page for tokens, topics, contracts,
  accounts and transactions.
- `compose` read `--requirement` while the flag is `--requirements`.

### Security

- Secrets are masked (first 6 characters at most) in console output, log
  files, `apix logs` / `apix last-error` and every CLI error message.
- Hedera inputs are validated before any network call, and the Hedera
  client is closed when the credentials are invalid.
- Vulnerable dependencies were upgraded or overridden: no critical or high
  advisories in production dependencies (`npm audit --omit=dev`). Upgrades:
  `@hashgraph/sdk` 2.80.0, with `protobufjs` and `@grpc/grpc-js` overridden
  (without the overrides, a critical and two high advisories return).
- CI runs gitleaks, and the `.env.example` API key exposed in October 2025
  was removed (see `docs/archive/SECURITY_INCIDENT_REPORT.md`).

## 2.0.3 and earlier (October–November 2025)

The Hedera Africa Hackathon 2025 releases. See `docs/archive/` for the
documents from that time; they are not maintained.
