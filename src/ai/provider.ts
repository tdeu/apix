// src/ai/provider.ts
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AIProvider, AIRequestError, AIUnavailableError, toAIRequestError } from './errors';
import { MODEL_ENV_VARS, ModelTier, resolveModel } from './models';

/**
 * The one place AI commands get a model from. Anthropic if ANTHROPIC_API_KEY
 * is set, otherwise OpenAI if OPENAI_API_KEY is set, otherwise
 * AIUnavailableError. There is no failover: if the chosen provider fails, the
 * request fails with AIRequestError carrying the provider's message.
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  system?: string;
  /** A single prompt, or a conversation ending with a user turn */
  prompt: string | ChatTurn[];
  /** Upper bound on the answer (OpenAI; Anthropic uses at least 16000 so thinking has room) */
  maxTokens?: number;
  /** OpenAI only: Anthropic's current models reject sampling parameters */
  temperature?: number;
}

export interface AIClient {
  readonly provider: AIProvider;
  readonly model: string;
  complete(request: CompletionRequest): Promise<string>;
}

// Minimal shapes of the SDK clients, so tests can inject fakes
export interface AnthropicLike {
  messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
}
export interface OpenAILike {
  chat: { completions: { create(params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming): Promise<OpenAI.Chat.ChatCompletion> } };
}

export interface AIClientOptions {
  tier?: ModelTier;
  /** Named in AIUnavailableError, e.g. "explain" */
  command?: string;
  env?: NodeJS.ProcessEnv;
  sdk?: { anthropic?: AnthropicLike; openai?: OpenAILike };
}

const REQUEST_TIMEOUT_MS = 120_000;
const ANTHROPIC_MIN_MAX_TOKENS = 16_000;

export function selectProvider(env: NodeJS.ProcessEnv = process.env): AIProvider | null {
  if (env.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  if (env.OPENAI_API_KEY?.trim()) return 'openai';
  return null;
}

/** Throws AIUnavailableError (with the command's message) when no AI key is set */
export function requireAIKey(command?: string, env: NodeJS.ProcessEnv = process.env): AIProvider {
  const provider = selectProvider(env);
  if (!provider) throw new AIUnavailableError(command);
  return provider;
}

export function createAIClient(options: AIClientOptions = {}): AIClient {
  const env = options.env ?? process.env;
  const provider = requireAIKey(options.command, env);
  const tier = options.tier ?? 'default';
  const model = resolveModel(provider, tier, env);
  const modelEnvVar = MODEL_ENV_VARS[provider][tier];

  if (provider === 'anthropic') {
    const sdk = options.sdk?.anthropic ?? new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 2,
    });
    return {
      provider,
      model,
      complete: request => completeWithAnthropic(sdk, model, modelEnvVar, request, env),
    };
  }

  const sdk = options.sdk?.openai ?? new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 2,
  });
  return {
    provider,
    model,
    complete: request => completeWithOpenAI(sdk, model, modelEnvVar, request, env),
  };
}

function toTurns(prompt: string | ChatTurn[]): ChatTurn[] {
  return typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : prompt;
}

async function completeWithAnthropic(
  sdk: AnthropicLike,
  model: string,
  modelEnvVar: string,
  request: CompletionRequest,
  env: NodeJS.ProcessEnv
): Promise<string> {
  let response: Anthropic.Message;
  try {
    response = await sdk.messages.create({
      model,
      max_tokens: Math.max(request.maxTokens ?? 0, ANTHROPIC_MIN_MAX_TOKENS),
      ...(request.system ? { system: request.system } : {}),
      messages: toTurns(request.prompt),
    });
  } catch (error) {
    throw toAIRequestError('anthropic', model, modelEnvVar, error, env);
  }

  if (response.stop_reason === 'refusal') {
    const category = (response as { stop_details?: { category?: string | null } }).stop_details?.category;
    throw new AIRequestError('anthropic', `Anthropic declined the request (refusal${category ? `: ${category}` : ''}).`);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AIRequestError('anthropic', 'Anthropic stopped at the token limit before finishing the answer.');
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();
  if (!text) {
    throw new AIRequestError('anthropic', 'Anthropic returned no text.');
  }
  return text;
}

async function completeWithOpenAI(
  sdk: OpenAILike,
  model: string,
  modelEnvVar: string,
  request: CompletionRequest,
  env: NodeJS.ProcessEnv
): Promise<string> {
  let response: OpenAI.Chat.ChatCompletion;
  try {
    response = await sdk.chat.completions.create({
      model,
      max_tokens: request.maxTokens ?? 4000,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      messages: [
        ...(request.system ? [{ role: 'system' as const, content: request.system }] : []),
        ...toTurns(request.prompt),
      ],
    });
  } catch (error) {
    throw toAIRequestError('openai', model, modelEnvVar, error, env);
  }

  const choice = response.choices[0];
  if (choice?.finish_reason === 'length') {
    throw new AIRequestError('openai', 'OpenAI stopped at the token limit before finishing the answer.');
  }
  const text = choice?.message?.content?.trim();
  if (!text) {
    throw new AIRequestError('openai', 'OpenAI returned no text.');
  }
  return text;
}
