// src/ai/json.ts
import { AIProvider, AIRequestError } from './errors';

/**
 * Parse JSON from an AI answer. Tolerates a ```json fence or text around the
 * JSON, but never substitutes defaults: an unparseable answer is an
 * AIRequestError.
 */
export function parseAIJson<T>(provider: AIProvider, text: string, what: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Fall through: try the outermost object or array in the text
  }

  const start = candidate.search(/[[{]/);
  const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    } catch {
      // reported below
    }
  }

  const name = provider === 'anthropic' ? 'Anthropic' : 'OpenAI';
  throw new AIRequestError(provider, `${name} returned a ${what} that isn't valid JSON, so APIX can't use it. Try again.`);
}
