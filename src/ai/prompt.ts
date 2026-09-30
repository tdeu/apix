// src/ai/prompt.ts

/**
 * A prompt with `{name}` placeholders. `{{` and `}}` stand for literal braces.
 * Formatting fails if a placeholder has no value, so a prompt is never sent
 * with a hole in it.
 */
export class PromptTemplate {
  private constructor(private readonly template: string) {}

  static fromTemplate(template: string): PromptTemplate {
    return new PromptTemplate(template);
  }

  /** The placeholder names, in order of first use */
  get inputVariables(): string[] {
    const names: string[] = [];
    for (const part of this.parts()) {
      if (part.variable && !names.includes(part.variable)) names.push(part.variable);
    }
    return names;
  }

  async format(values: Record<string, unknown>): Promise<string> {
    return this.parts()
      .map(part => {
        if (!part.variable) return part.text;
        const value = values[part.variable];
        if (value === undefined) {
          throw new Error(`Missing value for prompt variable "${part.variable}"`);
        }
        return typeof value === 'string' ? value : JSON.stringify(value);
      })
      .join('');
  }

  /** Left to right: `{{` and `}}` are literal braces, `{name}` is a placeholder */
  private parts(): Array<{ text: string; variable?: string }> {
    const parts: Array<{ text: string; variable?: string }> = [];
    let text = '';
    const t = this.template;
    for (let i = 0; i < t.length; i++) {
      if ((t[i] === '{' || t[i] === '}') && t[i + 1] === t[i]) {
        text += t[i];
        i++;
        continue;
      }
      const placeholder = t[i] === '{' ? /^\{([A-Za-z_][A-Za-z0-9_]*)\}/.exec(t.slice(i)) : null;
      if (placeholder) {
        parts.push({ text }, { text: '', variable: placeholder[1] });
        text = '';
        i += placeholder[0].length - 1;
        continue;
      }
      text += t[i];
    }
    parts.push({ text });
    return parts;
  }
}
