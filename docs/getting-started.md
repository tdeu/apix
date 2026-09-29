# Getting started

From nothing to a Next.js app that creates, mints and transfers a token on
Hedera testnet. The steps match the run recorded in
[TESTNET_PROOF.md](TESTNET_PROOF.md). On that laptop, the scaffold's own
`npm install` took about 2 minutes, and `apix add hts` through a successful
`next build` about 4 minutes.

## 1. Prerequisites

- Node.js 20 or later, npm and git.
- A Hedera **testnet** account. Create one for free at
  [portal.hedera.com](https://portal.hedera.com/faucet). You need its
  account ID (`0.0.x`) and its private key. Use the **DER-encoded** key the
  portal shows (it starts with `302`). A raw hex ECDSA key also works in
  generated apps.

## 2. Install APIX

npm still serves the hackathon release (2.0.3). Until 2.1.0 is published,
install from source:

```bash
git clone https://github.com/0xfishbone/apix.git
cd apix
npm ci
npm run build
npm link
apix --version
```

Once 2.1.0 is on npm, `npm install -g apix-ai` does the same.

## 3. Create a Next.js app

APIX supports Next.js with the App Router and TypeScript
([support matrix](../README.md#support-matrix)). It was tested with
create-next-app 16.3.6 (Next.js 16.3.6).

```bash
npx create-next-app@latest my-hedera-app --ts --app --src-dir --eslint --tailwind --import-alias "@/*" --use-npm --yes
cd my-hedera-app
```

## 4. Add HTS

```bash
apix add hts
```

This writes the files listed in [integrations.md](integrations.md#hts),
installs `@hashgraph/sdk` and `server-only`, and prints the next steps. No
Hedera call is made.

## 5. Configure the server

Create `.env.local` in the app (Next.js keeps it out of git by default):

```bash
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=302e...
```

These are server-side only. Never prefix them with `NEXT_PUBLIC_`. The
generated modules import `server-only`, so the build fails if client code
tries to import them.

## 6. Build and run

```bash
npx next build
npx next start
```

For development, use `npx next dev` instead. The app listens on
http://localhost:3000.

## 7. Call the routes

Every route signs with the account in `.env.local` (the operator). Replace
`0.0.TOKEN` with the ID returned by the first call, and `0.0.RECIPIENT` with
an account that can receive the token (it needs a free automatic
association slot, or an existing association).

```bash
curl -X POST http://localhost:3000/api/tokens/create \
  -H "content-type: application/json" \
  -d '{"name":"My Token","symbol":"MYT","decimals":2,"initialSupply":100000}'

curl "http://localhost:3000/api/tokens/info?tokenId=0.0.TOKEN"

curl -X POST http://localhost:3000/api/tokens/mint \
  -H "content-type: application/json" \
  -d '{"tokenId":"0.0.TOKEN","amount":5000}'

curl -X POST http://localhost:3000/api/tokens/transfer \
  -H "content-type: application/json" \
  -d '{"tokenId":"0.0.TOKEN","toAccountId":"0.0.RECIPIENT","amount":1000}'
```

Amounts are in the token's smallest unit: 100000 at 2 decimals is 1,000.00
tokens. Each response carries the transaction ID. Look it up on
[HashScan](https://hashscan.io/testnet) or the mirror node.

To use the UI instead, render the generated `TokenManager` component
(`src/components/TokenManager.tsx`) from a page.

## 8. More integrations

```bash
apix add consensus
apix add smart-contract
apix add wallet
```

See [integrations.md](integrations.md) for what each one generates, and
[troubleshooting.md](troubleshooting.md) if something fails.
