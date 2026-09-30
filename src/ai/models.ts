// src/ai/models.ts
import { AIProvider } from './errors';

/**
 * The models APIX's AI commands use, in one place. Each can be overridden
 * with an environment variable; APIX never switches models on its own (a
 * model the provider rejects is an error naming the variable to set).
 */
export type ModelTier = 'default' | 'fast';

export const MODEL_DEFAULTS = {
  anthropic: {
    default: 'claude-sonnet-5',
    fast: 'claude-haiku-4-5-20251001',
  },
  // Unchanged from before Phase 3b; to be verified (see BACKLOG)
  openai: {
    default: 'gpt-4o-mini',
    fast: 'gpt-4o-mini',
  },
} as const;

export const MODEL_ENV_VARS: Record<AIProvider, Record<ModelTier, string>> = {
  anthropic: { default: 'APIX_ANTHROPIC_MODEL', fast: 'APIX_ANTHROPIC_FAST_MODEL' },
  openai: { default: 'APIX_OPENAI_MODEL', fast: 'APIX_OPENAI_MODEL' },
};

export function resolveModel(provider: AIProvider, tier: ModelTier, env: NodeJS.ProcessEnv = process.env): string {
  const override = env[MODEL_ENV_VARS[provider][tier]]?.trim();
  return override || MODEL_DEFAULTS[provider][tier];
}
