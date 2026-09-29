// src/planning/support-policy.ts
import { ProjectContext, SupportedFramework } from '../types';

/**
 * What `apix add` supports in this version, as an allowlist. Checked before
 * anything is written, so a refused integration leaves the project unchanged.
 *
 *   Next.js + TypeScript      every integration
 *   React/Vite + TypeScript   wallet only (experimental)
 *   anything else             nothing
 */
export interface SupportDecision {
  /** Why the integration can't be added; undefined when it can */
  error?: string;
  /** Shown when the integration is allowed but not fully supported */
  notice?: string;
}

// These sign with the operator key, so they need server-side code
const SERVER_SIDE_INTEGRATIONS = ['hts', 'smart-contract', 'consensus'];

const FRAMEWORK_NAMES: Record<SupportedFramework, string> = {
  'next.js': 'Next.js',
  react: 'React/Vite',
  vue: 'Vue',
  angular: 'Angular',
  express: 'Express',
  node: 'plain Node.js',
  unknown: 'this project (no supported framework detected)',
};

export function checkIntegrationSupport(
  integration: string,
  context: Pick<ProjectContext, 'framework' | 'language'>
): SupportDecision {
  if (integration === 'account') {
    return { error: '`apix add account` is not available in this version.' };
  }

  const typescript = context.language === 'typescript';

  if (typescript && context.framework === 'next.js') {
    return {};
  }

  if (typescript && context.framework === 'react') {
    if (integration === 'wallet') {
      return { notice: 'Wallet integration is experimental on React/Vite.' };
    }
    if (SERVER_SIDE_INTEGRATIONS.includes(integration)) {
      return {
        error: `\`apix add ${integration}\` needs a server-side runtime; use Next.js. ` +
          'This looks like a React/Vite app, which runs only in the browser, where the ' +
          'operator private key must never go.'
      };
    }
  }

  const detected = FRAMEWORK_NAMES[context.framework] ?? context.framework;
  return {
    error: `\`apix add ${integration}\` doesn't support ${detected}${typescript ? '' : ' with JavaScript'} in this version. ` +
      'Supported: Next.js (App Router, TypeScript). Experimental: wallet on React/Vite.'
  };
}
