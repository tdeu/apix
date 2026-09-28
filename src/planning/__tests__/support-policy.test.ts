// src/planning/__tests__/support-policy.test.ts
import { checkIntegrationSupport } from '../support-policy';

const next = { framework: 'next.js' as const, language: 'typescript' as const };
const react = { framework: 'react' as const, language: 'typescript' as const };

describe('checkIntegrationSupport', () => {
  it.each(['hts', 'wallet', 'smart-contract', 'consensus'])('allows %s on Next.js + TypeScript', integration => {
    expect(checkIntegrationSupport(integration, next)).toEqual({});
  });

  it('refuses account everywhere', () => {
    expect(checkIntegrationSupport('account', next).error).toBe('`apix add account` is not available in this version.');
  });

  it.each(['hts', 'smart-contract', 'consensus'])('refuses %s on React/Vite', integration => {
    expect(checkIntegrationSupport(integration, react).error)
      .toMatch(new RegExp(`^\`apix add ${integration}\` needs a server-side runtime; use Next\\.js\\.`));
  });

  it('allows wallet on React/Vite with an experimental notice', () => {
    expect(checkIntegrationSupport('wallet', react)).toEqual({ notice: 'Wallet integration is experimental on React/Vite.' });
  });

  it.each(['hts', 'wallet', 'smart-contract', 'consensus'])('refuses %s in a JavaScript project', integration => {
    expect(checkIntegrationSupport(integration, { framework: 'next.js', language: 'javascript' }).error)
      .toMatch(/^TypeScript projects only in this version\./);
  });
});
