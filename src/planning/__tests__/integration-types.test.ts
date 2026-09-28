// src/planning/__tests__/integration-types.test.ts
import { describeIntegrations, normalizeIntegration } from '../integration-types';

describe('integration aliases', () => {
  it.each([
    ['hcs', 'consensus'],
    ['contract', 'smart-contract'],
    ['consensus', 'consensus'],
    ['hts', 'hts'],
    ['nope', 'nope'],
  ])('%s -> %s', (name, expected) => {
    expect(normalizeIntegration(name)).toBe(expected);
  });

  it('lists the advertised integrations with their aliases, without account', () => {
    expect(describeIntegrations()).toBe('hts, wallet, smart-contract (alias: contract), consensus (alias: hcs)');
  });
});
