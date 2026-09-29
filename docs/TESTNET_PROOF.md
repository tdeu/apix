# APIX testnet proof

What APIX actually does on Hedera testnet, verified independently on the
mirror node. Failures are listed as they happened; nothing here was patched
to make it pass.

- Date: 2026-09-29 (UTC)
- APIX: branch `phase-4/testnet-proof`, based on `ffac81a` (phase 3b). The
  library proof script is `scripts/testnet-proof.ts` (`npm run proof:testnet`);
  its raw output is [`testnet-proof.json`](testnet-proof.json).
- `@hashgraph/sdk` 2.80.0 (APIX and the generated app), hedera-agent-kit 3.8.2
- Network: testnet. Operator `0.0.10780747` (ECDSA), demo recipient
  `0.0.10777128` (ED25519, unlimited automatic associations)
- Mirror node: `https://testnet.mirrornode.hedera.com/api/v1`

"Mirror-verified" means the entity or transaction was read back from the
mirror node and matched what was expected (result `SUCCESS`, names, balances,
message contents).

## 1. Library: APIX's `hedera-operations`

| Operation | Result | Entity ID | Transaction ID | HashScan | Mirror-verified |
|---|---|---|---|---|---|
| Create fungible token "APIX Proof" / APIXP | ❌ token created, but APIX returned no token ID | 0.0.10781945 | 0.0.10780747@1790713674.355152205 | [token](https://hashscan.io/testnet/token/0.0.10781945) | Token exists; treasury 0.0.10780747 (operator, as expected); tx SUCCESS |
| Mint APIXP | ⚪ not available | - | - | - | n/a |
| Transfer 10.00 APIXP to 0.0.10777128 | ❌ skipped (no token ID from step 1) | - | - | - | n/a |
| Create HCS topic | ✅ | 0.0.10781947 | 0.0.10780747@1790713683.348618473 | [topic](https://hashscan.io/testnet/topic/0.0.10781947) | Yes (memo "APIX testnet proof", SUCCESS) |
| Submit topic message 1 | ✅ | 0.0.10781947 | 0.0.10780747@1790713690.529897674 | [tx](https://hashscan.io/testnet/transaction/1790713697.759223421) | Yes (sequence 1, content matches) |
| Submit topic message 2 | ✅ | 0.0.10781947 | 0.0.10780747@1790713695.555980689 | [tx](https://hashscan.io/testnet/transaction/1790713705.786089826) | Yes (sequence 2, content matches) |
| Deploy `StringStore` (solc 0.8.37, 861 bytes) | ✅ | 0.0.10781959 (bytecode file 0.0.10781958) | 0.0.10780747@1790713707.495222023 | [contract](https://hashscan.io/testnet/contract/0.0.10781959) | Yes (SUCCESS) |
| Call `set("hello from APIX")` | ❌ `CONTRACT_REVERT_EXECUTED` | 0.0.10781959 | 0.0.10780747@1790713714.712466286 | [tx](https://hashscan.io/testnet/transaction/1790713721.426691673) | Mirror records the revert |
| Call `get()`, check round trip | ⚪ not available | 0.0.10781959 | - | - | Mirror `eth_call` of `get()` returns `""`, not the value |

What this shows:

- **Token creation goes through hedera-agent-kit** whenever it initialises
  (it did here). The kit creates the token, but APIX reads `tokenId` from the
  wrong place in the kit's response (`{ raw: { tokenId, ... }, humanMessage }`)
  and reports success with no token ID or transaction ID. The kit's token
  also differs from APIX's own SDK path: `initialSupply` is taken in whole
  tokens (100000 at 2 decimals became 10,000,000 units), there is no admin or
  supply key, and supply is FINITE. So it can never be minted.
- **Mint is not implemented** in `hedera-operations`, and neither is any
  contract read.
- **Contract calls don't encode the function.** `callSmartContract` ignores
  `functionName` and `parameters` and sends a ContractExecute with no call
  data, so `set` reverts (the contract has no fallback). Deployment itself
  works: real compiled bytecode is on testnet.
- HCS works end to end.
- The library's own explorer links for topics and contracts point to
  `/account/<id>`; the links above use HashScan's `/topic/` and `/contract/`
  pages.

## 2. CLI

| Command | Result | Entity ID | Transaction ID | HashScan | Mirror-verified |
|---|---|---|---|---|---|
| `apix create-token --name "APIX CLI Proof" --symbol APIXC --decimals 2 --supply 5000 --admin-key --supply-key --testnet` | ❌ token created; CLI printed `Token ID: undefined` and exited 0 | 0.0.10781977 | 0.0.10780747@1790713752.307036102 | [token](https://hashscan.io/testnet/token/0.0.10781977) | Token exists; treasury 0.0.10780747; supply 500000 units; **no admin or supply key** despite the flags |
| `apix validate --testnet` | ✅ exit 0 | - | - | - | n/a: it checks local configuration only and says "No network call was made" |

`create-token` uses the same hedera-agent-kit path as the library, so it has
the same missing-ID problem, and `--admin-key` / `--supply-key` are silently
ignored.

## 3. Generated app (Next.js)

Scaffold: `create-next-app@16.3.6 --ts --app --eslint --tailwind --src-dir`
(the e2e harness settings), Next.js 16.3.6, React 19.2.8. Then
`apix add hts` and `apix add consensus`, with no Hedera keys in the
environment. Only `HEDERA_NETWORK`, `HEDERA_ACCOUNT_ID` and
`HEDERA_PRIVATE_KEY` were copied into `.env.local`, followed by `next build`
and `next start` (production mode). The routes were then called over HTTP.

| Route | Result | Entity ID | Transaction ID | HashScan | Mirror-verified |
|---|---|---|---|---|---|
| `POST /api/tokens/create` without `maxSupply` | ❌ HTTP 500, precheck `INVALID_TOKEN_MAX_SUPPLY` | - | 0.0.10780747@1790714291.898569429 (rejected at precheck, never reached consensus) | - | n/a |
| `POST /api/tokens/create` with `maxSupply: 10000000` (what the generated TokenManager UI sends) | ✅ HTTP 200 | 0.0.10782086 | 0.0.10780747@1790714404.799121175 | [token](https://hashscan.io/testnet/token/0.0.10782086) | Yes: APIX App Proof / APIXA, supply 100000, treasury 0.0.10780747, supply key set, SUCCESS |
| `GET /api/tokens/info` | ✅ HTTP 200 | 0.0.10782086 | - | [token](https://hashscan.io/testnet/token/0.0.10782086) | Yes (total supply matches the mirror node) |
| `POST /api/tokens/mint` (5000 units) | ✅ HTTP 200 | 0.0.10782086 | 0.0.10780747@1790714412.803122466 | [tx](https://hashscan.io/testnet/transaction/1790714422.008129390) | Yes: SUCCESS, supply 100000 → 105000 |
| `POST /api/tokens/transfer` (1000 units to 0.0.10777128) | ✅ HTTP 200 | 0.0.10782086 | 0.0.10780747@1790714420.633486720 | [tx](https://hashscan.io/testnet/transaction/1790714427.318174104) | Yes: SUCCESS, recipient balance 1000 |
| `POST /api/consensus/topics` | ✅ HTTP 200 | 0.0.10782081 | 0.0.10780747@1790714357.567419734 | [topic](https://hashscan.io/testnet/topic/0.0.10782081) | Yes (memo matches, SUCCESS) |
| `POST /api/consensus/messages` | ✅ HTTP 200 | 0.0.10782081 | 0.0.10780747@1790714369.924517287 | [tx](https://hashscan.io/testnet/transaction/1790714376.378164976) | Yes (sequence 1, content matches) |

The generated code defaults to a FINITE supply type but only sets a max
supply when one is passed. A direct API call that leaves out the optional
`maxSupply` therefore always fails; the generated UI always sends one. No
response contained the private key, and neither did the server or build logs.

### Timings (one run, Windows 10 laptop, about 1.2 to 1.4 GB free RAM)

| Step | Time |
|---|---|
| `npm install` of the fresh scaffold (before APIX, reported separately) | 107.7 s |
| `apix add hts` (includes its own `npm install` of `@hashgraph/sdk` and `server-only`, not timed separately) | 94.6 s |
| `apix add consensus` (no new packages) | 14.2 s |
| `next build` (compile 42 s, TypeScript 11.1 s) | 107.5 s |
| **From the start of `apix add hts` to a successful `next build`** | **246.6 s** |

Route latencies against testnet were 0.9 to 1.7 s per transaction (receipt
included).

## 4. Other runs during this proof

The library proof ran three times while the script was being finished. The
table in section 1 is run 3. Runs 1 and 2 created further testnet entities:
tokens 0.0.10781846 and 0.0.10781870 (same missing-ID behaviour), topics
0.0.10781847 and 0.0.10781872, and contracts 0.0.10781851 and 0.0.10781929
(same `set` revert). In run 2, the first topic message failed with the SDK's
`timeout exceeded`; the message never reached the topic, and the second
message landed as sequence 1. Run 3 had no timeouts.

A local run of the nightly smoke mode (`npm run proof:testnet -- --smoke`)
created token 0.0.10782161 (same missing-ID failure, so the smoke exits 1)
and topic 0.0.10782162 with one message (mirror-verified).

## 5. Not covered

- WalletConnect and the browser wallet flow (no project ID configured; the
  wallet UI was not exercised).
- OpenAI: unverified, because no OpenAI key was available.
