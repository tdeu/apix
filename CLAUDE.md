# APIX: working rules (v2.1 revival, Sep 2026)
This file supersedes docs/CLAUDE.md, which is kept for history only. Do not
follow docs/CLAUDE.md, and treat everything in docs/ as outdated hackathon
material, not a spec.

## Non-negotiables
- Never fake success: no mock responses, random outcomes, simulated
  transactions or test-account fallbacks. Real failures surface as errors
  with a clear, actionable message.
- Hedera commands require real credentials (see
  src/validation/environment-validator.ts) and fail fast without them.
- AI commands require ANTHROPIC_API_KEY or OPENAI_API_KEY. If missing, they
  exit with a clear error. Never return canned replies.
- Non-AI, non-blockchain commands (analyze, add, generate, help, status)
  must work with no keys at all.
- Private keys only ever appear in server-side generated code.
- Never print secrets in full (first 6 characters max).

## Process
- We work in phases. Stay inside the current phase's scope. If you find
  something outside it, list it in your report instead of fixing it.
- Branch: revive/2.1. Conventional commit messages (fix:, chore:, feat:...).
- Never push, publish to npm or rewrite git history without explicit instruction.
- Before committing (once available): npm run build:check, npm test and
  npm run lint must all pass.
- End every task with a structured report: status per task, what changed,
  anything surprising, decisions needed.
