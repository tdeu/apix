# Integrations

What `apix add <integration>` writes into a Next.js (App Router,
TypeScript) project. Paths below assume a `src/` layout: APIX follows the
project's layout, so without `src/` the same files go under the project
root. Every generated file imports its neighbours with relative paths.

`add` never overwrites a file that differs from what it would generate
unless you pass `--force`. If generation or `npm install` fails, the
project is restored exactly as it was.

## Signing model

All Hedera transactions are signed on the server by one operator account:
`HEDERA_ACCOUNT_ID` and `HEDERA_PRIVATE_KEY` in `.env.local`.

- The operator is the treasury of the tokens it creates and holds their
  supply key (so the mint route works). No admin key is set unless server
  code passes one. The operator sends every transfer.
- The server modules (`src/lib/hedera/*`) start with `import 'server-only'`,
  so a client component that imports them fails the build. The key never
  reaches the browser.
- The Hedera client is created on first use, not at import time, so
  `next build` works without credentials.
- A connected wallet (from `add wallet`) is only displayed and used to
  pre-fill a transfer recipient. It never signs or sends.

## Environment variables

Set these on the server (e.g. `.env.local`). Never prefix them with
`NEXT_PUBLIC_`.

| Variable | Required | Notes |
|---|---|---|
| `HEDERA_ACCOUNT_ID` | yes | Operator account, `0.0.x`. |
| `HEDERA_PRIVATE_KEY` | yes | DER-encoded (starts with `302`), or a raw hex ECDSA key. |
| `HEDERA_NETWORK` | no | `testnet` (default) or `mainnet`. |
| `HEDERA_MIRROR_NODE_URL` | no | Overrides the mirror node used by the client. |
| `NEXT_PUBLIC_HEDERA_NETWORK` | no | Only used by `TransactionStatus` to build HashScan links; set to `mainnet` for mainnet links. It holds no secret. |

Without the two required variables, the first route call fails with:

```
HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set on the server (e.g. in .env.local). Get a free testnet account at https://portal.hedera.com/faucet
```

## hts

Packages: `@hashgraph/sdk` (~2.80.0, the version APIX is tested with), `server-only`.

| File | Purpose |
|---|---|
| `src/lib/hedera/client.ts` | Server-side Hedera client from the environment variables. |
| `src/lib/hedera/hts-operations.ts` | `htsManager`: create, mint, transfer, token info (used by the routes), plus burn, associate and balance methods that no route uses and that weren't tested on testnet. |
| `src/app/api/tokens/create/route.ts` | `POST /api/tokens/create` |
| `src/app/api/tokens/info/route.ts` | `GET /api/tokens/info?tokenId=0.0.x` |
| `src/app/api/tokens/mint/route.ts` | `POST /api/tokens/mint` |
| `src/app/api/tokens/transfer/route.ts` | `POST /api/tokens/transfer` |
| `src/hooks/useTokens.ts`, `src/hooks/useWallet.ts` | Client hooks that call the routes. |
| `src/components/TokenManager.tsx` | UI for create, mint, transfer and info. |
| `src/components/TransactionStatus.tsx` | Shows a transaction with its HashScan link. |
| `src/components/hedera/{Button,Card,Input}.tsx` | UI primitives. |
| `src/types/hedera.ts` | Shared types. |

Routes (amounts in the token's smallest unit):

| Route | Body / query | Hedera transaction |
|---|---|---|
| `POST /api/tokens/create` | `name` (2-50 chars), `symbol` (2-6 uppercase letters), optional `decimals`, `initialSupply`, `maxSupply` | TokenCreateTransaction. The supply is INFINITE unless `maxSupply` is given. |
| `GET /api/tokens/info` | `tokenId` | TokenInfoQuery |
| `POST /api/tokens/mint` | `tokenId`, `amount` | TokenMintTransaction |
| `POST /api/tokens/transfer` | `tokenId`, `toAccountId`, `amount` | TransferTransaction from the operator. The recipient must be associated with the token or have a free automatic association slot. |

Invalid input returns HTTP 400 with an `error` message; Hedera failures
return HTTP 500 with `error` and `details`.

Token association is not part of 2.1: no route or hook associates an
account with a token, and the operator could only sign for its own account.
Send tokens to accounts with free automatic association slots, or have the
recipient associate the token from their wallet first.

## consensus (alias: hcs)

Packages: `@hashgraph/sdk`, `server-only`.

| File | Purpose |
|---|---|
| `src/lib/hedera/client.ts` | Shared with `hts` (not rewritten if identical). |
| `src/lib/hedera/consensus-operations.ts` | `consensusManager`: create topic, submit message, with input checks. |
| `src/app/api/consensus/topics/route.ts` | `POST /api/consensus/topics` `{ "memo"?: string, "restrictSubmit"?: boolean }` → TopicCreateTransaction |
| `src/app/api/consensus/messages/route.ts` | `POST /api/consensus/messages` `{ "topicId": "0.0.x", "message": string }` → TopicMessageSubmitTransaction |

Messages are limited to 1024 bytes and memos to 100 bytes (HTTP 400
otherwise). `restrictSubmit: true` sets the operator key as the topic's
submit key.

## smart-contract (alias: contract)

Packages: `@hashgraph/sdk`, `server-only`. No routes: you call the module
from your own server code.

| File | Purpose |
|---|---|
| `src/lib/hedera/client.ts` | Shared client. |
| `src/lib/hedera/smart-contract-operations.ts` | `smartContractManager`: `deployContract` (ContractCreateFlow; bytecode as a `0x` hex string, e.g. from solc), `executeContract` (ContractExecuteTransaction; arguments as `ContractFunctionParameters`), `callContract` (ContractCallQuery; returns the SDK's `ContractFunctionResult`). |

A generated app deployed a Solidity contract, called `set` and read `get`
back on testnet ([evidence](TESTNET_PROOF.md#3-generated-apps-nextjs)).
`deployContract` defaults to 100000 gas. The proof used 400000 for an
861-byte contract, so pass `gas` explicitly.

## wallet

Packages: `@hashgraph/sdk`. Browser-only code.

| File | Purpose |
|---|---|
| `src/lib/hedera/wallet-service.ts` | `walletService` with HashPack and Blade adapters (their browser extensions, via `window`). These are the only working providers. |
| `src/hooks/useWallet.ts` | Connection state for React. |
| `src/components/ConnectWallet.tsx` | A "connect your wallet" button and account display. |

WalletConnect is not implemented in the generated code. On React/Vite
projects, `wallet` is the only integration allowed, and it is experimental.
The browser wallet flow has not been tested end to end on testnet.

## account

Not available in this version: `apix add account` is refused.
