/**
 * Version ranges written into users' package.json by generated integrations.
 *
 * HEDERA_SDK_VERSION_RANGE is a tilde range on the @hashgraph/sdk version
 * pinned in our own package.json (a test enforces this): generated projects
 * get the SDK we test with, or a patch release of it, never a newer minor
 * (a caret range let fresh apps resolve 2.81.0 while APIX was proven on 2.80.0).
 */
export const HEDERA_SDK_VERSION_RANGE = '~2.80.0';

const GENERATED_DEPENDENCY_VERSIONS: Record<string, string> = {
  '@hashgraph/sdk': HEDERA_SDK_VERSION_RANGE,
  // Makes importing a server module from a client component a build error
  'server-only': '^0.0.1',
};

/**
 * npm `overrides` written into generated projects' package.json.
 *
 * These MUST mirror the `overrides` in APIX's own package.json: the transitive
 * packages @hashgraph/sdk pulls in carry advisories that APIX pins away for
 * itself, but overrides in APIX's package.json do not reach the apps APIX
 * generates, so each generated project needs its own copy for `npm audit` to
 * come back clean.
 *
 * - @grpc/grpc-js: the SDK pins an exact 1.12.6, which has two high-severity
 *   advisories (GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4), both fixed in 1.13.6
 *   (the first patched release, the smallest bump from 1.12.6).
 * - protobufjs: the SDK's @hashgraph/proto pulls a vulnerable protobufjs with a
 *   critical advisory; 7.6.6 is patched.
 *
 * npm reads `overrides`; yarn uses `resolutions` and pnpm uses `pnpm.overrides`.
 * The supported/tested stack installs with npm, so we write `overrides` only.
 */
export const GENERATED_PACKAGE_OVERRIDES: Record<string, string> = {
  '@grpc/grpc-js': '1.13.6',
  protobufjs: '7.6.6',
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
