// src/planning/support-policy.ts
import { ProjectContext } from '../types';

/**
 * What `apix add` supports in this version. Checked before anything is
 * written, so a refused integration leaves the project unchanged.
 */
export interface SupportDecision {
  /** Why the integration can't be added; undefined when it can */
  error?: string;
  /** Shown when the integration is allowed but not fully supported */
  notice?: string;
}

// These sign with the operator key, so they need server-side code
const SERVER_SIDE_INTEGRATIONS = ['hts', 'smart-contract', 'consensus'];

export function checkIntegrationSupport(
  integration: string,
  context: Pick<ProjectContext, 'framework' | 'language'>
): SupportDecision {
  if (integration === 'account') {
    return { error: '`apix add account` is not available in this version.' };
  }

  if (context.language !== 'typescript') {
    return {
      error: 'TypeScript projects only in this version. ' +
        'Add a tsconfig.json (npx tsc --init) or start from a TypeScript template.'
    };
  }

  if (context.framework === 'react') {
    if (SERVER_SIDE_INTEGRATIONS.includes(integration)) {
      return {
        error: `\`apix add ${integration}\` needs a server-side runtime; use Next.js. ` +
          'This looks like a React/Vite app, which runs only in the browser, where the ' +
          'operator private key must never go.'
      };
    }
    if (integration === 'wallet') {
      return { notice: 'Wallet integration is experimental on React/Vite.' };
    }
  }

  return {};
}
