// src/ai/errors.ts
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { maskSecrets } from '../utils/secrets';

export type AIProvider = 'anthropic' | 'openai';

const PROVIDER_NAMES: Record<AIProvider, string> = { anthropic: 'Anthropic', openai: 'OpenAI' };

/** No AI key is configured, so an AI command can't run */
export class AIUnavailableError extends Error {
  constructor(readonly command?: string) {
    super(aiUnavailableMessage(command));
    this.name = 'AIUnavailableError';
  }
}

export function aiUnavailableMessage(command?: string): string {
  const subject = command ? `\`apix ${command}\`` : 'This command';
  let message = `${subject} needs an AI key. Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) in your .env.`;
  if (command === 'generate') {
    message += ' For templates without AI, use `apix add <type>`.';
  }
  return message;
}

/** The AI provider was reachable (or not) but the request failed */
export class AIRequestError extends Error {
  constructor(
    readonly provider: AIProvider,
    message: string,
    readonly status?: number,
    /** The env var that selects the model, when the model itself was rejected */
    readonly modelEnvVar?: string
  ) {
    super(maskSecrets(message));
    this.name = 'AIRequestError';
  }
}

/**
 * Turn an SDK error into an AIRequestError with the provider's own message.
 * A model the provider doesn't recognise gets a message naming the env var
 * that overrides it; APIX never switches to another model on its own.
 */
export function toAIRequestError(
  provider: AIProvider,
  model: string,
  modelEnvVar: string,
  error: unknown,
  /** The env the client was built from, so its keys are masked too */
  env: NodeJS.ProcessEnv = process.env
): AIRequestError {
  if (error instanceof AIRequestError) return error;
  const name = PROVIDER_NAMES[provider];

  const apiError = provider === 'anthropic'
    ? (error instanceof Anthropic.APIError ? error : null)
    : (error instanceof OpenAI.APIError ? error : null);

  if (apiError) {
    const status = typeof apiError.status === 'number' ? apiError.status : undefined;
    const detail = maskSecrets(apiError.message || 'no details', env);

    if (isConnectionError(provider, error)) {
      return new AIRequestError(provider, `Could not reach ${name}: ${detail}`);
    }
    if (status === 401) {
      return new AIRequestError(provider, `${name} rejected the API key (401): ${detail}`, status);
    }
    if (status === 404 || (status === 400 && /model/i.test(detail))) {
      return new AIRequestError(
        provider,
        `${name} could not use model "${model}" (${status}): ${detail}. ` +
        `Set ${modelEnvVar} to a model your account can use.`,
        status,
        modelEnvVar
      );
    }
    if (status === 429) {
      return new AIRequestError(provider, `${name} rate limit reached (429): ${detail}`, status);
    }
    return new AIRequestError(provider, `${name} request failed${status ? ` (${status})` : ''}: ${detail}`, status);
  }

  const message = maskSecrets(error instanceof Error ? error.message : String(error), env);
  return new AIRequestError(provider, `${name} request failed: ${message}`);
}

function isConnectionError(provider: AIProvider, error: unknown): boolean {
  return provider === 'anthropic'
    ? error instanceof Anthropic.APIConnectionError
    : error instanceof OpenAI.APIConnectionError;
}
