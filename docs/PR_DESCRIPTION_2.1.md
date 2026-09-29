# APIX 2.1.0: honest rebuild, testnet-proven

## Summary

This merges the 2.1 revival into `master`. The October 2025 hackathon build
overstated what worked: a simulation mode, testnet IDs that were never
created, generated code that didn't compile, canned AI replies and a random
"retry". The revival removes all of that. What remains either works or fails
with a clear error.

The Hedera operations APIX performs and generates were run on testnet and
verified on the mirror node. The full story, with the decisions, how to
verify and what's left, is in `docs/REVIVAL_2.1.md`.

- The generated Next.js integrations (HTS, HCS, smart contracts, wallet)
  install, type-check and build as generated.
- They sign on the server only (`server-only` guard, operator key never in
  the browser).
- The AI commands need a real key and never return canned replies.
- Secrets are masked everywhere, and spending on mainnet needs a
  confirmation.
- `deploy`, 31 flags that did nothing, hedera-agent-kit, LangChain, dead code,
  12 unused templates and 12 unused dependencies were removed.
- Production audit: 11 advisories (7 low, 4 moderate), 0 high, 0 critical.

Merge with a merge commit. The per-phase draft PRs are closed as "included".

## Phases (each branch contains the previous one)

| Phase | Branch | Head | What |
|---|---|---|---|
| 0 | `revive/2.1` | `ff06801` | Working rules (CLAUDE.md), canonical repo |
| 1 | `phase-1/tooling` | `80a5281` | Jest runs, ESLint 9, BACKLOG, CI with gitleaks |
| 2 | `phase-2/deps` | `19e2bd0` | SDK 2.80.0 pin, vulnerable dependencies fixed, audit gate |
| 3a | `phase-3a/hedera-honest` | `0fb03fc` | No test-account fallback, input validation, honest health |
| 3c | `phase-3c/working-generation` | `e682e05` | Generated code builds, HCS, support allowlist, overwrite protection, e2e harness |
| 3b | `phase-3b/ai-honest` | `ffac81a` | No canned AI replies, one provider selector, no random retry, secrets masked |
| 4 | `phase-4/testnet-proof` | `5f8f1a0` | Testnet proof script, evidence, nightly smoke (found real bugs) |
| 4b | `phase-4b/testnet-fixes` | `4651e14` | Fixes (SDK token creation, receipt IDs, contract encoding, mint, mainnet guard), re-proof |
| 5a | `phase-5a/docs-release-prep` | this PR's head | Docs rewrite and archive, 2.1.0 packaging, dead code, flags and dependencies removed, `~2.80.0` in generated apps, re-proof, handover |

## Evidence

`docs/TESTNET_PROOF.md` lists every operation with its entity ID,
transaction ID, HashScan link and mirror-node check:

- **Library**, latest run on `@hashgraph/sdk` 2.80.0 (9/9 steps
  mirror-verified):
  - token `0.0.10783823`: created, minted and transferred;
  - topic `0.0.10783825`, with two messages;
  - contract `0.0.10783827`: deployed, `set` called and `get` read back.
- **CLI**: `apix create-token` created token `0.0.10782464` with admin and
  supply keys, and printed its real ID and links.
- **Generated Next.js apps**: the token and topic routes, and the generated
  contract module, all ran on testnet under `next start`.
- **Observed testnet fees**: token create about 13 ℏ, contract deploy about
  15 ℏ.

## Not verified yet

- **CI has never run**: GitHub Actions isn't enabled on the repo. The
  workflows exist but have produced no results, so this PR has no CI checks.
- **Jest and the e2e harness on Linux**: everything was run on a Windows
  laptop (26 test files, 246 tests passing, lint 0 errors).
- **The full e2e matrix** (Pages Router and Vite, every case), and the
  experimental **Vite wallet** case.
- **The default OpenAI model** (`gpt-4o-mini`), because no OpenAI key was
  available.
- **Other gaps**: the browser wallet flow and WalletConnect; mainnet was
  never touched.

## Release checklist (in order)

1. Enable GitHub Actions (repo owner).
2. Add the repo secrets `HEDERA_ACCOUNT_ID` / `HEDERA_PRIVATE_KEY` from any
   testnet account, for the nightly smoke (repo owner).
3. Get CI green on master: re-run the workflows, or push (repo owner, or
   anyone with write access).
4. `npm owner add` if needed, then publish 2.1.0 (npm owner of `apix-ai`).
5. Create the GitHub release v2.1.0 (repo owner, or anyone with write
   access).
6. Make the repository public (repo owner).
7. Fill in `DISCORD_INVITE_URL` and the CHANGELOG release date, and update
   the "until 2.1.0 is published" notes (anyone with write access).

Open items: `BACKLOG.md`. Working rules: `CLAUDE.md`. Details:
`docs/REVIVAL_2.1.md`.
