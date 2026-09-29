// src/utils/secrets.ts

/** Environment variables whose values must never be printed in full */
export const SECRET_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'HEDERA_PRIVATE_KEY',
  'WALLETCONNECT_PROJECT_ID',
  'ENCRYPTION_KEY',
  'JWT_SECRET',
] as const;

const VISIBLE_CHARS = 6;

/** First 6 characters, then an ellipsis: enough to tell keys apart, not to use them */
export function maskValue(value: string): string {
  return value.length <= VISIBLE_CHARS ? '***' : `${value.slice(0, VISIBLE_CHARS)}…`;
}

/**
 * Replace every configured secret value that appears in `text` with its
 * masked form. Values shorter than 8 characters are left alone (too likely
 * to match ordinary text, and too short to be real keys).
 */
export function maskSecrets(text: string, env: NodeJS.ProcessEnv = process.env): string {
  let masked = text;
  for (const name of SECRET_ENV_VARS) {
    const value = env[name];
    if (value && value.length >= 8) {
      masked = masked.split(value).join(maskValue(value));
    }
  }
  return masked;
}

/** Deep copy of a value with secret strings masked (for logging objects) */
export function maskSecretsDeep<T>(value: T, env: NodeJS.ProcessEnv = process.env, seen = new WeakSet<object>()): T {
  if (typeof value === 'string') return maskSecrets(value, env) as unknown as T;
  if (value && typeof value === 'object') {
    // Circular structures (common in HTTP errors) are cut, not followed
    if (seen.has(value)) return '[Circular]' as unknown as T;
    seen.add(value);
  }
  if (Array.isArray(value)) return value.map(item => maskSecretsDeep(item, env, seen)) as unknown as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if (value instanceof Error) {
      const copy = new Error(maskSecrets(value.message, env));
      copy.name = value.name;
      copy.stack = value.stack ? maskSecrets(value.stack, env) : undefined;
      return copy as unknown as T;
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = maskSecretsDeep(item, env, seen);
    }
    return out as T;
  }
  return value;
}
