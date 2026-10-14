// The mainnet proof spends real HBAR: it must refuse unless the network and
// both flags agree. Pure function, no SDK and no network.

import { MAINNET_CONSENT_FLAG, MAINNET_FLAG, MAINNET_MIN_BALANCE_HBAR, resolveProofMode } from '../proof-mode';

describe('resolveProofMode', () => {
  it('runs the testnet proof on testnet without flags', () => {
    expect(resolveProofMode('testnet', [])).toEqual({ run: 'testnet', smoke: false });
    expect(resolveProofMode('testnet', ['--smoke'])).toEqual({ run: 'testnet', smoke: true });
  });

  it('runs on mainnet only with the network and both flags', () => {
    expect(resolveProofMode('mainnet', [MAINNET_FLAG, MAINNET_CONSENT_FLAG])).toEqual({ run: 'mainnet' });
  });

  it.each([
    ['no flags', []],
    ['only --mainnet', [MAINNET_FLAG]],
    ['only the consent flag', [MAINNET_CONSENT_FLAG]],
    ['a misspelled consent flag', [MAINNET_FLAG, '--i-understand']],
    ['--yes instead of the consent flag', [MAINNET_FLAG, '--yes']],
  ])('refuses mainnet with %s', (_label, argv) => {
    const mode = resolveProofMode('mainnet', argv);
    expect(mode.run).toBe('refuse');
    expect(mode).toHaveProperty('reason', expect.stringContaining(MAINNET_CONSENT_FLAG));
  });

  it('refuses the mainnet flags when the network is testnet', () => {
    expect(resolveProofMode('testnet', [MAINNET_FLAG, MAINNET_CONSENT_FLAG]).run).toBe('refuse');
    expect(resolveProofMode('testnet', [MAINNET_FLAG]).run).toBe('refuse');
    expect(resolveProofMode('testnet', [MAINNET_CONSENT_FLAG]).run).toBe('refuse');
  });

  it.each([undefined, '', 'previewnet', 'MAINNET', 'main'])('refuses the network %p, even with both flags', network => {
    expect(resolveProofMode(network, [MAINNET_FLAG, MAINNET_CONSENT_FLAG]).run).toBe('refuse');
    expect(resolveProofMode(network, []).run).toBe('refuse');
  });

  it('refuses --smoke on mainnet', () => {
    expect(resolveProofMode('mainnet', [MAINNET_FLAG, MAINNET_CONSENT_FLAG, '--smoke']).run).toBe('refuse');
  });

  it('keeps the balance floor at 25 HBAR', () => {
    expect(MAINNET_MIN_BALANCE_HBAR).toBe(25);
  });
});
