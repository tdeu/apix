// src/planning/__tests__/support-policy.test.ts
import { checkIntegrationSupport } from '../support-policy';
import { SupportedFramework } from '../../types';

const ts = (framework: SupportedFramework) => ({ framework, language: 'typescript' as const });
const js = (framework: SupportedFramework) => ({ framework, language: 'javascript' as const });
const INTEGRATIONS = ['hts', 'wallet', 'smart-contract', 'consensus'];
const SUPPORTED = 'Supported: Next.js (App Router, TypeScript). Experimental: wallet on React/Vite.';

describe('checkIntegrationSupport', () => {
  it.each(INTEGRATIONS)('allows %s on Next.js + TypeScript', integration => {
    expect(checkIntegrationSupport(integration, ts('next.js'))).toEqual({});
  });

  it('refuses account everywhere', () => {
    for (const context of [ts('next.js'), ts('react'), js('vue')]) {
      expect(checkIntegrationSupport('account', context).error).toBe('`apix add account` is not available in this version.');
    }
  });

  it('allows wallet on React/Vite + TypeScript with an experimental notice', () => {
    expect(checkIntegrationSupport('wallet', ts('react'))).toEqual({ notice: 'Wallet integration is experimental on React/Vite.' });
  });

  it.each(['hts', 'smart-contract', 'consensus'])('refuses %s on React/Vite (needs a server)', integration => {
    expect(checkIntegrationSupport(integration, ts('react')).error)
      .toMatch(new RegExp(`^\`apix add ${integration}\` needs a server-side runtime; use Next\\.js\\.`));
  });

  it.each([
    ['vue', 'Vue'],
    ['angular', 'Angular'],
    ['express', 'Express'],
    ['node', 'plain Node.js'],
    ['unknown', 'this project (no supported framework detected)'],
  ] as Array<[SupportedFramework, string]>)('refuses every integration on %s', (framework, name) => {
    for (const integration of INTEGRATIONS) {
      expect(checkIntegrationSupport(integration, ts(framework)).error)
        .toBe(`\`apix add ${integration}\` doesn't support ${name} in this version. ${SUPPORTED}`);
    }
  });

  it.each(['next.js', 'react', 'vue'] as SupportedFramework[])('refuses every integration in a JavaScript %s project', framework => {
    for (const integration of INTEGRATIONS) {
      expect(checkIntegrationSupport(integration, js(framework)).error)
        .toMatch(new RegExp(`^\`apix add ${integration}\` doesn't support .+ with JavaScript in this version\\. `));
    }
  });

  it('names the framework in the JavaScript message', () => {
    expect(checkIntegrationSupport('wallet', js('next.js')).error)
      .toBe(`\`apix add wallet\` doesn't support Next.js with JavaScript in this version. ${SUPPORTED}`);
  });
});
