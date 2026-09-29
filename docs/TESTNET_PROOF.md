# APIX testnet proof

What APIX actually does on Hedera testnet, verified independently on the
mirror node. Phase 4 ran the first proof and found failures. Phase 4b fixed
them and re-ran everything below that the fixes touched. The history is in
[Issues found and fixed in 4b](#issues-found-and-fixed-in-4b). The library
proof was re-run at the end of Phase 5a, after hedera-agent-kit and
LangChain were removed
([re-verification](#re-verified-on-hashgraphsdk-2800)).

- Dates: 2026-09-29 (UTC). Phase 4 proof, the Phase 4b re-proof, and the
  Phase 5a re-verification of the library.
- APIX: branches `phase-4b/testnet-fixes` and `phase-5a/docs-release-prep`.
  The library proof script is `scripts/testnet-proof.ts`
  (`npm run proof:testnet`); [`testnet-proof.json`](testnet-proof.json)
  holds the raw output of the latest run (the Phase 5a re-verification).
- `@hashgraph/sdk` **2.80.0**: installed in APIX (pinned exactly) and used by
  every run below. Generated apps get `~2.80.0`, so they install the same
  version (or a 2.80 patch release), never an untested minor. The Phase 4 and
  4b runs still had hedera-agent-kit 3.8.2 installed (unused since 4b); it
  was removed in Phase 5a.
- Network: testnet. Operator `0.0.10780747` (ECDSA); demo recipient
  `0.0.10777128` (ED25519, unlimited automatic associations).
- Mirror node: `https://testnet.mirrornode.hedera.com/api/v1`

"Mirror-verified" means the entity or transaction was read back from the
mirror node and matched what was expected (result `SUCCESS`, names, keys,
supply, balances, message contents, contract state).

## 1. Library: APIX's `hedera-operations` (Phase 4b run)

| Operation | Entity ID | Transaction ID | HashScan | Mirror-verified |
|---|---|---|---|---|
| Create token APIX Proof / APIXP (2 decimals, 100000 units, admin + supply key) | 0.0.10782448 | 0.0.10780747@1790716292.703771441 | [token](https://hashscan.io/testnet/token/0.0.10782448) | ✅ INFINITE supply 100000, treasury 0.0.10780747, admin and supply key set, SUCCESS |
| Mint 5000 units | 0.0.10782448 | 0.0.10780747@1790716300.064285207 | [tx](https://hashscan.io/testnet/transaction/1790716307.808900571) | ✅ SUCCESS, supply 100000 → 105000 |
| Transfer 1000 units to 0.0.10777128 | 0.0.10782448 | 0.0.10780747@1790716307.423465151 | [tx](https://hashscan.io/testnet/transaction/1790716315.634416320) | ✅ SUCCESS, recipient balance 1000 |
| Create HCS topic | 0.0.10782451 | 0.0.10780747@1790716314.311164733 | [topic](https://hashscan.io/testnet/topic/0.0.10782451) | ✅ memo "APIX testnet proof", SUCCESS |
| Submit topic message 1 | 0.0.10782451 | 0.0.10780747@1790716317.329169119 | [tx](https://hashscan.io/testnet/transaction/1790716325.208728884) | ✅ sequence 1, content matches |
| Submit topic message 2 | 0.0.10782451 | 0.0.10780747@1790716321.989607343 | [tx](https://hashscan.io/testnet/transaction/1790716331.534265335) | ✅ sequence 2, content matches |
| Deploy `StringStore` (solc 0.8.37, 861 bytes) | 0.0.10782455 | 0.0.10780747@1790716332.897451940 | [contract](https://hashscan.io/testnet/contract/0.0.10782455) | ✅ SUCCESS |
| `set("hello from APIX")` (`callSmartContract`) | 0.0.10782455 | 0.0.10780747@1790716339.631535012 | [tx](https://hashscan.io/testnet/transaction/1790716347.528714104) | ✅ SUCCESS |
| `get()` (`queryContract`) | 0.0.10782455 | (query, no transaction) | [contract](https://hashscan.io/testnet/contract/0.0.10782455) | ✅ `queryContract` and a mirror-node `eth_call` both return "hello from APIX" |

## 2. CLI (Phase 4b run)

`apix create-token --name "APIX CLI Proof" --symbol APIXC --decimals 2 --supply 500000 --admin-key --supply-key`
(exit 0):

```
Token Details:
   Name: APIX CLI Proof
   Symbol: APIXC
   Decimals: 2
   Initial Supply: 500,000 smallest units (5,000.00 tokens)
   Supply Type: INFINITE
   Keys (operator key): admin, supply
   Network: TESTNET
✔ ✅ Token created successfully!
Token Information:
   Token ID: 0.0.10782464
   Transaction ID: 0.0.10780747@1790716393.105341414
   Treasury Account: 0.0.10780747
   Token on HashScan: https://hashscan.io/testnet/token/0.0.10782464
   Transaction on HashScan: https://hashscan.io/testnet/transaction/0.0.10780747-1790716393-105341414
```

| Command | Entity ID | Transaction ID | HashScan | Mirror-verified |
|---|---|---|---|---|
| `apix create-token … --admin-key --supply-key` | 0.0.10782464 | 0.0.10780747@1790716393.105341414 | [token](https://hashscan.io/testnet/token/0.0.10782464) | ✅ SUCCESS; INFINITE supply 500000; treasury 0.0.10780747; admin and supply key are both the operator's public key |
| `apix validate` (Phase 4) | - | - | - | n/a: checks local configuration only and says so |

## 3. Generated apps (Next.js)

Scaffold: `create-next-app@16.3.6 --ts --app --eslint --tailwind --src-dir`
(the e2e harness settings), Next.js 16.3.6. Each app ran `apix add …` with
no Hedera keys in the environment. Only `HEDERA_NETWORK`,
`HEDERA_ACCOUNT_ID` and `HEDERA_PRIVATE_KEY` were copied into `.env.local`,
followed by `next build` and `next start` (production mode). Routes were
called over HTTP. No response contained the private key. Each app folder
was deleted afterwards.

| Route | Phase | Entity ID | Transaction ID | HashScan | Mirror-verified |
|---|---|---|---|---|---|
| `POST /api/tokens/create` **without** `maxSupply` | 4b | 0.0.10782603 | 0.0.10780747@1790716927.486973871 | [token](https://hashscan.io/testnet/token/0.0.10782603) | ✅ INFINITE supply 100000, treasury 0.0.10780747, SUCCESS |
| `POST /api/tokens/create` with `maxSupply` | 4 | 0.0.10782086 | 0.0.10780747@1790714404.799121175 | [token](https://hashscan.io/testnet/token/0.0.10782086) | ✅ supply 100000, supply key set, SUCCESS |
| `GET /api/tokens/info` | 4 | 0.0.10782086 | - | [token](https://hashscan.io/testnet/token/0.0.10782086) | ✅ total supply matches |
| `POST /api/tokens/mint` (5000 units) | 4 | 0.0.10782086 | 0.0.10780747@1790714412.803122466 | [tx](https://hashscan.io/testnet/transaction/1790714422.008129390) | ✅ supply 100000 → 105000 |
| `POST /api/tokens/transfer` (1000 units to 0.0.10777128) | 4 | 0.0.10782086 | 0.0.10780747@1790714420.633486720 | [tx](https://hashscan.io/testnet/transaction/1790714427.318174104) | ✅ recipient balance 1000 |
| `POST /api/consensus/topics` | 4 | 0.0.10782081 | 0.0.10780747@1790714357.567419734 | [topic](https://hashscan.io/testnet/topic/0.0.10782081) | ✅ memo matches, SUCCESS |
| `POST /api/consensus/messages` | 4 | 0.0.10782081 | 0.0.10780747@1790714369.924517287 | [tx](https://hashscan.io/testnet/transaction/1790714376.378164976) | ✅ sequence 1, content matches |
| Generated `smartContractManager.deployContract` (StringStore, gas 400000) | 4b | 0.0.10782597 | 0.0.10780747@1790716920.458919431 | [contract](https://hashscan.io/testnet/contract/0.0.10782597) | ✅ CONTRACTCREATEINSTANCE SUCCESS |
| Generated `executeContract` `set(...)` | 4b | 0.0.10782597 | 0.0.10780747@1790716922.763173095 | [tx](https://hashscan.io/testnet/transaction/1790716932.529658508) | ✅ CONTRACTCALL SUCCESS |
| Generated `callContract` `get()` | 4b | 0.0.10782597 | (query) | [contract](https://hashscan.io/testnet/contract/0.0.10782597) | ✅ returns "hello from an APIX-generated app"; the mirror `eth_call` agrees |

The contract rows came from a temporary route written only for this proof
(it is not part of APIX's templates). It called the generated
`src/lib/hedera/smart-contract-operations.ts` exactly as an app would.

### Timings (Phase 4, one run, Windows 10 laptop, about 1.2 to 1.4 GB free RAM)

| Step | Time |
|---|---|
| `npm install` of the fresh scaffold (before APIX, reported separately) | 107.7 s |
| `apix add hts` (includes its own `npm install` of `@hashgraph/sdk` and `server-only`, not timed separately) | 94.6 s |
| `apix add consensus` (no new packages) | 14.2 s |
| `next build` (compile 42 s, TypeScript 11.1 s) | 107.5 s |
| **From the start of `apix add hts` to a successful `next build`** | **246.6 s** |

The 4b app (hts + smart-contract, about 0.8 to 1.0 GB free RAM) took:
scaffold install 132.9 s, `add hts` 134.5 s, `add smart-contract` 22.9 s,
and `next build` 94.1 s. These were not measured as one continuous run.
Route latencies were 0.9 to 1.7 s per transaction. The contract route took
8.0 s for deploy + set + get.

## Re-verified on @hashgraph/sdk 2.80.0

The library proof re-run at the end of Phase 5a (2026-09-29, 23:21 UTC)
with `npm run proof:testnet`. This is the current code, after
hedera-agent-kit, LangChain and the dead code were removed, with
`@hashgraph/sdk` 2.80.0. All 9 steps passed and all 9 were mirror-verified.

| Operation | Entity ID | Transaction ID | HashScan | Mirror-verified |
|---|---|---|---|---|
| Create token APIX Proof / APIXP (2 decimals, 100000 units, admin + supply key) | 0.0.10783823 | 0.0.10780747@1790724058.665191045 | [token](https://hashscan.io/testnet/token/0.0.10783823) | ✅ INFINITE supply 100000, treasury 0.0.10780747, admin and supply key set, SUCCESS |
| Mint 5000 units | 0.0.10783823 | 0.0.10780747@1790724064.483153170 | [tx](https://hashscan.io/testnet/transaction/1790724070.724038762) | ✅ SUCCESS, supply 100000 → 105000 |
| Transfer 1000 units to 0.0.10777128 | 0.0.10783823 | 0.0.10780747@1790724074.402215110 | [tx](https://hashscan.io/testnet/transaction/1790724085.211281104) | ✅ SUCCESS, recipient balance 1000 |
| Create HCS topic | 0.0.10783825 | 0.0.10780747@1790724084.403428272 | [topic](https://hashscan.io/testnet/topic/0.0.10783825) | ✅ memo "APIX testnet proof", SUCCESS |
| Submit topic message 1 | 0.0.10783825 | 0.0.10780747@1790724088.635393032 | [tx](https://hashscan.io/testnet/transaction/1790724096.251351104) | ✅ sequence 1, content matches |
| Submit topic message 2 | 0.0.10783825 | 0.0.10780747@1790724096.546172289 | [tx](https://hashscan.io/testnet/transaction/1790724101.480615266) | ✅ sequence 2, content matches |
| Deploy `StringStore` (solc 0.8.37, 861 bytes) | 0.0.10783827 | 0.0.10780747@1790724106.710048582 | [contract](https://hashscan.io/testnet/contract/0.0.10783827) | ✅ SUCCESS |
| `set("hello from APIX")` | 0.0.10783827 | 0.0.10780747@1790724106.649929506 | [tx](https://hashscan.io/testnet/transaction/1790724113.803933546) | ✅ SUCCESS |
| `get()` (`queryContract`) | 0.0.10783827 | (query, no transaction) | [contract](https://hashscan.io/testnet/contract/0.0.10783827) | ✅ `queryContract` and a mirror-node `eth_call` both return "hello from APIX" |

The CLI and generated-app rows in sections 2 and 3 are from Phase 4 and 4b,
on the same SDK version. Since then, the generated templates for the
supported integrations are byte-identical (checked with
`npm run snapshot:templates`), and a fresh Next.js app with `apix add hts`
installed, type-checked and built in the e2e harness. The CLI and
generated-app rows were not re-run on testnet.

## Fees observed

The fees charged to the operator for the Phase 4b library transactions,
read from the mirror node (`charged_tx_fee`). These are testnet fees in HBAR
at the time of the run; fees are set in USD and vary with the HBAR price,
the network, and the transaction's size and options.

| Transaction | Hedera type | Charged fee |
|---|---|---|
| Create token (admin + supply key) | TokenCreateTransaction | 12.94 ℏ |
| Mint | TokenMintTransaction | 0.013 ℏ |
| Transfer to 0.0.10777128 (first transfer, recipient auto-associated) | TransferTransaction | 0.65 ℏ |
| Create topic | TopicCreateTransaction | 0.13 ℏ |
| Submit topic message | TopicMessageSubmitTransaction | 0.002 ℏ |
| Deploy StringStore via ContractCreateFlow: bytecode file (FileCreateTransaction), contract (ContractCreateTransaction), file cleanup (FileDeleteTransaction) | 3 transactions | 1.64 + 13.07 + 0.09 = 14.80 ℏ |
| Call `set(...)` (gas 100000) | ContractExecuteTransaction | 0.05 ℏ |

`get()` is a ContractCallQuery (a paid query, not a transaction), so it has
no transaction record.

## Issues found and fixed in 4b

The Phase 4 proof found these. All are fixed, and the rows above are the
re-proof:

1. **Token creation went through hedera-agent-kit and lost the token ID.**
   `apix create-token` printed `Token ID: undefined` and exited 0. The
   kit's token also ignored APIX's options: supply in whole tokens, no keys,
   FINITE supply (Phase 4 tokens 0.0.10781945, 0.0.10781977). Now every
   token is created with APIX's own `TokenCreateTransaction`. The initial
   supply is in smallest units, supply is INFINITE unless `maxSupply` is
   given, and the key flags set the operator key.
2. **Success without an ID.** Every operation now takes its entity ID,
   sequence number or total supply from the receipt. If the receipt lacks
   it, the operation fails, and `create-token` exits 1.
3. **Contract calls weren't encoded.** `callSmartContract` ignored the
   function name and arguments, so `set` reverted
   (`CONTRACT_REVERT_EXECUTED`, Phase 4 contract 0.0.10781959). It now
   ABI-encodes string, bool, uint256, int256, address and bytes32
   arguments. The new `queryContract` reads view functions and decodes
   string, bool, uint256 and address return values. The generated
   `smart-contract-operations` template already encoded calls correctly and
   was unchanged; section 3 proves it on testnet.
4. **No mint in the library.** `mintToken` was added.
5. **Generated token creation without `maxSupply` failed** with
   `INVALID_TOKEN_MAX_SUPPLY` (HTTP 500), because the supply type defaulted
   to FINITE. It is now INFINITE unless a max supply is given.
6. **Wrong HashScan pages.** Topics and contracts linked to
   `/account/<id>`. Links now use `/token/`, `/topic/`, `/contract/`,
   `/account/` and `/transaction/`.

Other Phase 4 runs created tokens 0.0.10781846, 0.0.10781870 and
0.0.10782161; topics 0.0.10781847, 0.0.10781872, 0.0.10781947 and
0.0.10782162; and contracts 0.0.10781851 and 0.0.10781929. One Phase 4 run hit a transient SDK `timeout exceeded` on
a topic message.

## Not covered

- WalletConnect and the browser wallet flow (no project ID configured; the
  wallet UI was not exercised).
- OpenAI: unverified, because no OpenAI key was available.
- Mainnet: never touched.
