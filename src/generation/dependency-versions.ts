/**
 * Version ranges written into users' package.json by generated integrations.
 *
 * HEDERA_SDK_VERSION_RANGE is a tilde range on the @hiero-ledger/sdk version
 * pinned in our own package.json (a test enforces this): generated projects
 * get the SDK we test with, or a patch release of it, never a newer minor
 * (a caret range let fresh apps resolve 2.81.0 while APIX was proven on 2.80.0).
 */
export const HEDERA_SDK_VERSION_RANGE = '~2.90.0';

const GENERATED_DEPENDENCY_VERSIONS: Record<string, string> = {
  '@hiero-ledger/sdk': HEDERA_SDK_VERSION_RANGE,
  // Makes importing a server module from a client component a build error
  'server-only': '^0.0.1',
};

/**
 * npm `overrides` written into generated projects' package.json.
 *
 * These MUST mirror the `overrides` in APIX's own package.json: the transitive
 * packages @hiero-ledger/sdk pulls in carry advisories that APIX pins away for
 * itself, but overrides in APIX's package.json do not reach the apps APIX
 * generates, so each generated project needs its own copy for `npm audit` to
 * come back clean.
 *
 * - ws (under ethers only): the SDK pins ethers 6.16.0, which pins an exact
 *   ws 8.17.1 with two high-severity advisories (GHSA-58qx-3vcg-4xpx,
 *   GHSA-96hv-2xvq-fx4p, fixed after 8.20.1). Scoped to ethers so other ws
 *   users in the project keep their own range.
 *
 * npm reads `overrides`; yarn uses `resolutions` and pnpm uses `pnpm.overrides`.
 * The supported/tested stack installs with npm, so we write `overrides` only.
 */
export const GENERATED_PACKAGE_OVERRIDES: Record<string, string | Record<string, string>> = {
  ethers: { ws: '8.21.3' },
};

export function generatedDependencyVersion(name: string): string {
  const version = GENERATED_DEPENDENCY_VERSIONS[name];
  if (!version) {
    throw new Error(
      `No version range defined for generated dependency "${name}". ` +
      'Add it to src/generation/dependency-versions.ts'
    );
  }
  return version;
}
