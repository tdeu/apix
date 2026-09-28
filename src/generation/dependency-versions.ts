/**
 * Version ranges written into users' package.json by generated integrations.
 *
 * HEDERA_SDK_VERSION_RANGE must match the @hashgraph/sdk version pinned in
 * our own package.json (a test enforces this), so generated code is built
 * against the SDK we test with.
 */
export const HEDERA_SDK_VERSION_RANGE = '^2.80.0';

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
