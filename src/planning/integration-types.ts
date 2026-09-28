// src/planning/integration-types.ts

/** Integration types `apix add` accepts (account is refused by support-policy) */
export const INTEGRATION_TYPES = ['hts', 'wallet', 'smart-contract', 'consensus', 'account'] as const;

/** Alternative names, mapped once when the command is parsed */
export const INTEGRATION_ALIASES: Record<string, (typeof INTEGRATION_TYPES)[number]> = {
  hcs: 'consensus',
  contract: 'smart-contract',
};

export function normalizeIntegration(name: string): string {
  return INTEGRATION_ALIASES[name] ?? name;
}

/** For --help: "hts, wallet, smart-contract (alias: contract), consensus (alias: hcs)" */
export function describeIntegrations(): string {
  return INTEGRATION_TYPES
    .filter(type => type !== 'account')
    .map(type => {
      const aliases = Object.keys(INTEGRATION_ALIASES).filter(alias => INTEGRATION_ALIASES[alias] === type);
      return aliases.length > 0 ? `${type} (alias: ${aliases.join(', ')})` : type;
    })
    .join(', ');
}
