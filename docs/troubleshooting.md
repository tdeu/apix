# Troubleshooting

The messages below are the ones APIX actually prints (taken from its code),
with what to do about each. Add `--debug` to a command for more detail, and
run `apix last-error` to see the last logged error (secrets are masked).

## `apix add`

**Unsupported project**

```
`apix add hts` doesn't support Vue in this version. Supported: Next.js (App Router, TypeScript). Experimental: wallet on React/Vite.
```

APIX 2.1 generates code only for Next.js with the App Router and
TypeScript. On React/Vite with TypeScript, only `wallet` is allowed.
Nothing was written.

```
`apix add hts` needs a server-side runtime; use Next.js. This looks like a React/Vite app, which runs only in the browser, where the operator private key must never go.
```

`hts`, `consensus` and `smart-contract` sign with a private key, which must
stay on a server. Use a Next.js project.

```
API routes are only generated for the Next.js App Router. This project uses the Pages Router (pages/).
```

`hts` and `consensus` generate App Router route handlers. `wallet` and
`smart-contract` work with the Pages Router.

```
`apix add account` is not available in this version.
```

**Files would be overwritten**

```
These files already exist and differ from what APIX would generate:
  - src/lib/hedera/client.ts
Nothing was written. Re-run with --force to overwrite them.
```

Check the listed files, then re-run with `--force` if you want APIX's
version. Files that are already identical are skipped, not rewritten.

**npm install failed**

```
Dependency installation failed with npm

Command: npm install (in /path/to/app)
Exit code: 1
npm output (last 30 lines):
...
Run `npm install` yourself to see the full output.
```

APIX restores the project to its previous state. Fix what npm reports (a
version conflict or a network problem, for example) and run `apix add`
again.

## Hedera credentials

```
Hedera credentials are not configured.
Set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in your .env file (HEDERA_NETWORK defaults to testnet).
Get a free testnet account at https://portal.hedera.com/faucet
```

APIX commands read `.env` from the current directory. A generated app reads
`.env.local`; that's a different file.

```
Hedera credentials are invalid:
  Invalid HEDERA_ACCOUNT_ID format: "123"
  Expected format: 0.0.123
```

Other variants: `HEDERA_PRIVATE_KEY appears to be invalid (too short)`, and
`Invalid HEDERA_NETWORK` (use `testnet` or `mainnet`).

**In a generated app**

```
HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set on the server (e.g. in .env.local). Get a free testnet account at https://portal.hedera.com/faucet
```

Add both to `.env.local` and restart `next dev` / `next start`. Don't prefix
them with `NEXT_PUBLIC_`.

## Hedera transaction errors

These come from the network and appear in `apix create-token` output, or in
a route's `details` field.

| Status | Meaning | What to do |
|---|---|---|
| `INSUFFICIENT_PAYER_BALANCE` | The operator doesn't have enough HBAR. | Fund it (testnet: [faucet](https://portal.hedera.com/faucet)). A token create costs about 13 ℏ on testnet ([fees](TESTNET_PROOF.md#fees-observed)). |
| `INVALID_SIGNATURE` | The private key doesn't belong to `HEDERA_ACCOUNT_ID`. | Check both values come from the same account. |
| `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT` | The transfer recipient isn't associated with the token and has no free automatic association slot. | Associate the token from the recipient's wallet, or use an account with automatic associations. |
| `INVALID_TOKEN_MAX_SUPPLY` | A FINITE supply without a valid max supply. | Generated code from APIX 2.1 creates an INFINITE supply when `maxSupply` is omitted. Pass a positive `maxSupply` for a capped token. |
| `CONTRACT_REVERT_EXECUTED` | The contract call reverted. | Check the function name and arguments, and give it enough gas. |

## Mainnet

```
HEDERA_NETWORK is mainnet and this command spends real HBAR. There is no terminal to confirm on: re-run with --yes to proceed.
```

```
Cancelled: nothing was sent to mainnet.
```

`create-token` and `add hts --create-token` ask before spending on mainnet.
In scripts, pass `--yes` only when you mean it.

## AI commands

```
`apix explain` needs an AI key. Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) in your .env.
```

The other AI provider errors:

- `Anthropic rejected the API key (401): …` means the key is wrong or
  revoked.
- `Anthropic could not use model "…" (404): …. Set APIX_ANTHROPIC_MODEL to a model your account can use.`
  means your account can't use the default model; set the variable named in
  the message.
- `Anthropic rate limit reached (429): …` means you should wait and retry.
- `Anthropic returned a … that isn't valid JSON, so APIX can't use it. Try again.`
  can happen occasionally; run the command again.

(OpenAI errors read the same, with `OpenAI` and `APIX_OPENAI_MODEL`.)

```
compose is experimental; re-run with --experimental
```

## Build

**`next build` fails because a client component imports `src/lib/hedera/*`**:
the generated server modules import `server-only` on purpose, so the
private key can't reach the browser. Call them from a route handler or a
server component instead.
