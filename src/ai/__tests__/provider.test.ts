import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { createAIClient, requireAIKey, selectProvider, AnthropicLike, OpenAILike } from '../provider';
import { AIRequestError, AIUnavailableError, aiUnavailableMessage } from '../errors';
import { MODEL_DEFAULTS, resolveModel } from '../models';
import { parseAIJson } from '../json';

// No network: every SDK client below is a fake injected through `sdk`

const ANTHROPIC_KEY = 'sk-ant-test-0123456789abcdef';
const OPENAI_KEY = 'sk-proj-test-0123456789abcdef';

function anthropicReply(message: Partial<Anthropic.Message>): AnthropicLike & { create: jest.Mock } {
  const create = jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Hello from Claude' }],
    stop_reason: 'end_turn',
    ...message,
  });
  return { messages: { create }, create };
}

function anthropicThrows(error: unknown): AnthropicLike {
  return { messages: { create: jest.fn().mockRejectedValue(error) } };
}

function openaiReply(choice: Record<string, unknown>): OpenAILike & { create: jest.Mock } {
  const create = jest.fn().mockResolvedValue({
    choices: [{ finish_reason: 'stop', message: { content: 'Hello from GPT' }, ...choice }],
  });
  return { chat: { completions: { create } }, create };
}

function openaiThrows(error: unknown): OpenAILike {
  return { chat: { completions: { create: jest.fn().mockRejectedValue(error) } } };
}

describe('provider selection', () => {
  it('prefers Anthropic, then OpenAI, then nothing', () => {
    expect(selectProvider({ ANTHROPIC_API_KEY: ANTHROPIC_KEY, OPENAI_API_KEY: OPENAI_KEY })).toBe('anthropic');
    expect(selectProvider({ OPENAI_API_KEY: OPENAI_KEY })).toBe('openai');
    expect(selectProvider({})).toBeNull();
    expect(selectProvider({ ANTHROPIC_API_KEY: '   ' })).toBeNull();
  });

  it('throws AIUnavailableError naming the command when no key is set', () => {
    expect(() => requireAIKey('explain', {})).toThrow(AIUnavailableError);
    expect(() => requireAIKey('explain', {})).toThrow(
      '`apix explain` needs an AI key. Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) in your .env.'
    );
    expect(() => createAIClient({ command: 'chat', env: {} })).toThrow(AIUnavailableError);
  });

  it('points generate at `apix add` for templates without AI', () => {
    expect(aiUnavailableMessage('generate')).toBe(
      '`apix generate` needs an AI key. Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) in your .env. ' +
      'For templates without AI, use `apix add <type>`.'
    );
    expect(aiUnavailableMessage('debug')).not.toContain('apix add');
  });
});

describe('models', () => {
  it('uses current defaults and env overrides', () => {
    expect(resolveModel('anthropic', 'default', {})).toBe('claude-sonnet-5');
    expect(resolveModel('anthropic', 'fast', {})).toBe('claude-haiku-4-5-20251001');
    expect(resolveModel('openai', 'default', {})).toBe(MODEL_DEFAULTS.openai.default);
    expect(resolveModel('anthropic', 'default', { APIX_ANTHROPIC_MODEL: 'claude-opus-5' })).toBe('claude-opus-5');
    expect(resolveModel('anthropic', 'fast', { APIX_ANTHROPIC_FAST_MODEL: 'x-fast' })).toBe('x-fast');
    expect(resolveModel('openai', 'default', { APIX_OPENAI_MODEL: 'gpt-x' })).toBe('gpt-x');
  });

  it('has no claude-3 model left', () => {
    expect(JSON.stringify(MODEL_DEFAULTS)).not.toMatch(/claude-3/);
  });
});

describe('Anthropic client', () => {
  const env = { ANTHROPIC_API_KEY: ANTHROPIC_KEY };

  it('sends the model, system and turns without sampling parameters', async () => {
    const sdk = anthropicReply({});
    const client = createAIClient({ env, sdk: { anthropic: sdk } });
    expect(client.provider).toBe('anthropic');
    expect(client.model).toBe('claude-sonnet-5');

    const text = await client.complete({ system: 'be brief', prompt: 'hi', maxTokens: 500, temperature: 0.7 });
    expect(text).toBe('Hello from Claude');
    const params = sdk.create.mock.calls[0][0];
    expect(params).toMatchObject({ model: 'claude-sonnet-5', system: 'be brief', messages: [{ role: 'user', content: 'hi' }] });
    expect(params.max_tokens).toBeGreaterThanOrEqual(16000);
    expect(params).not.toHaveProperty('temperature');
  });

  it('treats a refusal as an error', async () => {
    const client = createAIClient({ env, sdk: { anthropic: anthropicReply({ stop_reason: 'refusal' as any, content: [] }) } });
    await expect(client.complete({ prompt: 'x' })).rejects.toThrow(/declined the request/);
  });

  it('treats a truncated answer as an error', async () => {
    const client = createAIClient({ env, sdk: { anthropic: anthropicReply({ stop_reason: 'max_tokens' }) } });
    await expect(client.complete({ prompt: 'x' })).rejects.toThrow(/token limit/);
  });

  it('treats an empty answer as an error', async () => {
    const client = createAIClient({ env, sdk: { anthropic: anthropicReply({ content: [] }) } });
    await expect(client.complete({ prompt: 'x' })).rejects.toThrow('Anthropic returned no text.');
  });

  it('names the env var when the model is not found, and does not switch model', async () => {
    const notFound = new Anthropic.NotFoundError(404, undefined, 'model: claude-sonnet-5 not found', new Headers());
    const sdk = anthropicThrows(notFound);
    const client = createAIClient({ env, sdk: { anthropic: sdk } });
    const error = await client.complete({ prompt: 'x' }).catch(e => e);
    expect(error).toBeInstanceOf(AIRequestError);
    expect(error.message).toContain('could not use model "claude-sonnet-5"');
    expect(error.message).toContain('Set APIX_ANTHROPIC_MODEL');
    expect(error.modelEnvVar).toBe('APIX_ANTHROPIC_MODEL');
    expect(sdk.messages.create).toHaveBeenCalledTimes(1);
  });

  it('reports a rejected key without printing it', async () => {
    const unauthorized = new Anthropic.AuthenticationError(401, undefined, `invalid x-api-key ${ANTHROPIC_KEY}`, new Headers());
    const client = createAIClient({ env, sdk: { anthropic: anthropicThrows(unauthorized) } });
    const error = await client.complete({ prompt: 'x' }).catch(e => e);
    expect(error.message).toContain('rejected the API key (401)');
    expect(error.message).not.toContain(ANTHROPIC_KEY);
    expect(error.message).toContain(ANTHROPIC_KEY.slice(0, 6));
  });

  it('reports a connection failure', async () => {
    const client = createAIClient({ env, sdk: { anthropic: anthropicThrows(new Anthropic.APIConnectionError({ message: 'ECONNREFUSED' })) } });
    await expect(client.complete({ prompt: 'x' })).rejects.toThrow('Could not reach Anthropic: ECONNREFUSED');
  });
});

describe('OpenAI client', () => {
  const env = { OPENAI_API_KEY: OPENAI_KEY };

  it('sends system first, then the turns, with temperature', async () => {
    const sdk = openaiReply({});
    const client = createAIClient({ env, sdk: { openai: sdk } });
    expect(client.provider).toBe('openai');

    const text = await client.complete({ system: 'sys', prompt: [{ role: 'user', content: 'q' }], temperature: 0.3 });
    expect(text).toBe('Hello from GPT');
    expect(sdk.create.mock.calls[0][0]).toMatchObject({
      model: MODEL_DEFAULTS.openai.default,
      temperature: 0.3,
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'q' }],
    });
  });

  it('treats a truncated answer as an error', async () => {
    const client = createAIClient({ env, sdk: { openai: openaiReply({ finish_reason: 'length' }) } });
    await expect(client.complete({ prompt: 'x' })).rejects.toThrow(/token limit/);
  });

  it('names APIX_OPENAI_MODEL when the model is not found', async () => {
    const notFound = new OpenAI.NotFoundError(404, undefined, 'The model does not exist', {});
    const client = createAIClient({ env, sdk: { openai: openaiThrows(notFound) } });
    await expect(client.complete({ prompt: 'x' })).rejects.toThrow(/Set APIX_OPENAI_MODEL/);
  });

  it('reports rate limits with the provider message', async () => {
    const limited = new OpenAI.RateLimitError(429, undefined, 'slow down', {});
    const client = createAIClient({ env, sdk: { openai: openaiThrows(limited) } });
    await expect(client.complete({ prompt: 'x' })).rejects.toThrow(/rate limit reached \(429\).*slow down/);
  });
});

describe('parseAIJson', () => {
  it('reads plain, fenced and embedded JSON', () => {
    expect(parseAIJson('anthropic', '{"a":1}', 'thing')).toEqual({ a: 1 });
    expect(parseAIJson('anthropic', 'Here:\n```json\n{"a":2}\n```', 'thing')).toEqual({ a: 2 });
    expect(parseAIJson('openai', 'Sure! {"a":3} Hope that helps', 'thing')).toEqual({ a: 3 });
  });

  it('throws instead of substituting defaults', () => {
    expect(() => parseAIJson('openai', 'no json here', 'risk assessment')).toThrow(
      "OpenAI returned a risk assessment that isn't valid JSON, so APIX can't use it. Try again."
    );
  });
});
