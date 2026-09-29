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
