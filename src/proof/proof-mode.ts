// src/proof/proof-mode.ts
//
// Which network scripts/testnet-proof.ts may run on. Kept here, away from the
// script, so the decision can be unit-tested without loading the Hedera SDK
// or touching the network. Not part of the published package.

export const MAINNET_FLAG = '--mainnet';
export const MAINNET_CONSENT_FLAG = '--i-understand-this-spends-real-hbar';

/** The mainnet proof refuses to start with less than this in the operator account */
export const MAINNET_MIN_BALANCE_HBAR = 25;

export type ProofMode =
  | { run: 'testnet'; smoke: boolean }
  | { run: 'mainnet' }
  | { run: 'refuse'; reason: string };

/**
 * Mainnet spends real HBAR, so it runs only when all three agree:
 * HEDERA_NETWORK=mainnet, --mainnet and --i-understand-this-spends-real-hbar.
 * Any partial or contradictory combination is refused; nothing falls back to
 * the other network.
 */
export function resolveProofMode(network: string | undefined, argv: readonly string[]): ProofMode {
  const mainnetFlag = argv.includes(MAINNET_FLAG);
  const consentFlag = argv.includes(MAINNET_CONSENT_FLAG);
  const smoke = argv.includes('--smoke');

  if (network === 'testnet') {
    if (mainnetFlag || consentFlag) {
      return { run: 'refuse', reason: `${MAINNET_FLAG} was given but HEDERA_NETWORK is "testnet". Nothing was run.` };
    }
    return { run: 'testnet', smoke };
  }

  if (network === 'mainnet') {
    if (!mainnetFlag || !consentFlag) {
      return {
        run: 'refuse',
        reason:
          `HEDERA_NETWORK is "mainnet". The mainnet proof spends real HBAR and only runs with both ` +
          `${MAINNET_FLAG} and ${MAINNET_CONSENT_FLAG}. Nothing was run.`,
      };
    }
    if (smoke) {
      return { run: 'refuse', reason: '--smoke is a testnet option and cannot be combined with the mainnet proof. Nothing was run.' };
    }
    return { run: 'mainnet' };
  }

  return {
    run: 'refuse',
    reason: `HEDERA_NETWORK is "${network ?? ''}", not "testnet" or "mainnet". Nothing was run.`,
  };
}
