# APIX mainnet proof

APIX's own Hedera operations, run once on Hedera **mainnet** and verified
independently on the mainnet mirror node. The broader proof (transfers,
smart contracts, the CLI and generated apps) is on testnet:
[TESTNET_PROOF.md](TESTNET_PROOF.md).

- Date: 2026-10-13, 13:47:35 to 13:48:12 UTC.
- APIX: 2.1.2, branch `feat/mainnet-proof` on top of commit `8951898`. The
  script is `scripts/testnet-proof.ts` in mainnet mode
  ([how to run it](../CONTRIBUTING.md#mainnet-mode));
  [`mainnet-proof.json`](mainnet-proof.json) holds the raw output of the
  run, with the corrections listed [below](#corrections).
- `@hashgraph/sdk` **2.80.0**.
- Network: mainnet. Mirror node:
  `https://mainnet.mirrornode.hedera.com/api/v1`
- Operator: [`0.0.10917500`](https://hashscan.io/mainnet/account/0.0.10917500),
  a dedicated proof account (ECDSA) holding 40 ℏ, used for nothing else.

"Mirror-verified" means the entity and its transaction were read back from
the mirror node and matched what was expected (result `SUCCESS`, name,
symbol, decimals, keys, supply, topic memo, message contents).

## Results

| Operation | Entity ID | Transaction ID | Charged fee (ℏ) | HashScan | Mirror-verified |
|---|---|---|---|---|---|
| Create fungible token "APIX Mainnet Proof" / APIXM (2 decimals, initial supply 1000 units, infinite supply, admin and supply keys = operator key) | `0.0.10917503` | `0.0.10917500@1791899251.588247010` | 11.73295332 | [token](https://hashscan.io/mainnet/token/0.0.10917503) | yes |
| Mint 100 units (total supply 1100) | `0.0.10917503` | `0.0.10917500@1791899256.815112663` | 0.01161677 | [transaction](https://hashscan.io/mainnet/transaction/1791899264.626861931) | yes |
| Create HCS topic, memo "APIX mainnet proof" | `0.0.10917504` | `0.0.10917500@1791899266.021919266` | 0.11616784 | [topic](https://hashscan.io/mainnet/topic/0.0.10917504) | yes |
| Submit message "APIX mainnet proof 2026-10-13T13:47:35.428Z" (sequence 1) | `0.0.10917504` | `0.0.10917500@1791899269.945781945` | 0.00197484 | [transaction](https://hashscan.io/mainnet/transaction/1791899286.785292931) | yes |

4 of 4 steps succeeded and were mirror-verified. Nothing was retried.

## Cost

**Total cost: 11.86271276 ℏ**, the change in the operator's balance
(40.00000001 ℏ before, 28.13728725 ℏ after).

The four charged fees add up to 11.86271277 ℏ, one tinybar more. The
difference is not a fee: during the run, account `0.0.10231006`, which has
nothing to do with this proof, sent 1 tinybar to the operator (consensus
`1791899263.016527104`).

## Hollow account

The operator was a hollow account: created by an HBAR transfer to its EVM
alias, with no key on the network. Its first transaction, the token
creation, was signed with the matching ECDSA key and completed it.

- Before the run, the mirror node showed no key for `0.0.10917500`.
- The token creation produced two records under one transaction ID: a
  zero-fee `CRYPTOUPDATEACCOUNT` child record (nonce 1, consensus
  `1791899257.596197103`) that set the key, and the `TOKENCREATION` record
  itself (nonce 0, consensus `1791899257.596197104`).
- After the run, the mirror node shows an `ECDSA_SECP256K1` key on the
  account.

## Corrections

The run printed a charged fee of 0 ℏ for the token creation, and a total of
0.12975945 ℏ. Both were wrong: the script read the first record of the
transaction ID, which was the zero-fee child record above, not the token
creation. The fee in the table (11.73295332 ℏ) was read afterwards from the
mainnet mirror node, and `mainnet-proof.json` was amended to match, with a
`corrections` entry that keeps the original values. The script now picks
the record with nonce 0.

## Not covered on mainnet

Token transfers, smart contract deployment and calls, the CLI
(`apix create-token`, `apix add hts --create-token`) and generated apps
were not run on mainnet. They are covered on testnet only.
