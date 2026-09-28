// src/generation/module-paths.ts
import path from 'path';
import { ProjectLayout } from '../analysis/project-layout';

/**
 * Every module APIX can generate, by logical id, as a path inside the
 * project's source root (no extension). Templates import each other through
 * these ids ({{importFrom "hts-operations"}}), so imports are relative and
 * work with any alias setup, or none.
 */
export const MODULES = {
  'hedera-client': 'lib/hedera/client',
  'hts-operations': 'lib/hedera/hts-operations',
  'smart-contract-operations': 'lib/hedera/smart-contract-operations',
  'wallet-service': 'lib/hedera/wallet-service',
  'hedera-types': 'types/hedera',
  'use-tokens': 'hooks/useTokens',
  'use-wallet': 'hooks/useWallet',
  'use-token-operations': 'hooks/useTokenOperations',
  'token-manager': 'components/TokenManager',
  'transaction-status': 'components/TransactionStatus',
  'wallet-connect': 'components/WalletConnect',
  // Not components/ui/: that is where shadcn/ui puts button.tsx etc., and
  // Button.tsx would collide with it on case-insensitive file systems
  'ui-button': 'components/hedera/Button',
  'ui-input': 'components/hedera/Input',
  'ui-card': 'components/hedera/Card',
} as const;

export type ModuleId = keyof typeof MODULES;

const join = (...parts: string[]) => path.posix.join(...parts.filter(Boolean));

/** Module path relative to the project root, without extension */
export function modulePath(layout: ProjectLayout, id: ModuleId): string {
  return join(layout.sourceRoot, MODULES[id]);
}

/** Output file for a module, relative to the project root */
export function moduleFile(layout: ProjectLayout, id: ModuleId, extension: '.ts' | '.tsx'): string {
  return `${modulePath(layout, id)}${extension}`;
}

/** Output file for a Next.js App Router API route, e.g. 'tokens/create' */
export function apiRouteFile(layout: ProjectLayout, route: string): string {
  if (layout.router !== 'app' || !layout.routesDir) {
    throw new Error(
      'API routes are only generated for the Next.js App Router. ' +
      `This project uses ${layout.router === 'pages' ? `the Pages Router (${layout.routesDir}/)` : 'no Next.js router'}.`
    );
  }
  return join(layout.routesDir, 'api', route, 'route.ts');
}

/** Every module's path relative to the project root, for the importFrom helper */
export function modulePathMap(layout: ProjectLayout): Record<ModuleId, string> {
  return Object.fromEntries(
    (Object.keys(MODULES) as ModuleId[]).map(id => [id, modulePath(layout, id)])
  ) as Record<ModuleId, string>;
}

/** Relative import specifier from one generated file to a module path */
export function relativeImport(fromFile: string, toModulePath: string): string {
  const relative = path.posix.relative(path.posix.dirname(fromFile), toModulePath);
  return relative.startsWith('.') ? relative : `./${relative}`;
}
