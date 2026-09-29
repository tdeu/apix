# APIX: working rules (v2.1 revival, Sep 2026)
This file supersedes docs/archive/CLAUDE.md, which is kept for history only.
Do not follow docs/archive/CLAUDE.md, and treat everything in docs/archive/
as outdated hackathon material, not a spec. The maintained docs are README.md,
CONTRIBUTING.md and the guides in docs/.

## Non-negotiables
- Never fake success: no mock responses, random outcomes, simulated
  transactions or test-account fallbacks. Real failures surface as errors
  with a clear, actionable message.
- Hedera commands (create-token, validate, `add hts --create-token`) require
  real credentials (see src/utils/environment-validator.ts) and fail fast
  without them. Spending on mainnet needs an explicit confirmation or --yes.
- AI commands (chat, generate, recommend, explain, compare, confidence,
  debug) require ANTHROPIC_API_KEY or OPENAI_API_KEY. If missing, they exit
  with a clear error. Never return canned replies. `compose` is experimental:
  hidden from --help unless APIX_EXPERIMENTAL=1, refused without
  --experimental (or APIX_EXPERIMENTAL=1), and it also needs an AI key.
- Non-AI, non-blockchain commands (analyze, add, init, status, health, logs,
  last-error, debug-info, --help, --version) must work with no keys at all.
  `add hts` may offer optional real token creation only when Hedera
  credentials are present.
- Private keys only ever appear in server-side generated code.
- Never print secrets in full (first 6 characters max).

## Process
- We work in phases. Stay inside the current phase's scope. If you find
  something outside it, list it in your report instead of fixing it.
- Canonical repo: github.com/0xfishbone/apix (origin).
  Default branch: master. Work happens on revive/2.1 (or per-phase branches
  off it) and is merged into master by PR only.
- Branch: revive/2.1. Conventional commit messages (fix:, chore:, feat:...).
- Never push, publish to npm or rewrite git history without explicit instruction.
- Before committing (once available): npm run build:check, npm test and
  npm run lint must all pass.
- End every task with a structured report: status per task, what changed,
  anything surprising, decisions needed.
