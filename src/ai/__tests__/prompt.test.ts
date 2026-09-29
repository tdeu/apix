import { PromptTemplate } from '../prompt';

describe('PromptTemplate', () => {
  it('fills placeholders, stringifying non-strings', async () => {
    const prompt = PromptTemplate.fromTemplate('Req: {requirement}\nCtx: {context}\nAgain: {requirement}');
    expect(prompt.inputVariables).toEqual(['requirement', 'context']);
    await expect(prompt.format({ requirement: 'mint tokens', context: { industry: 'retail' } }))
      .resolves.toBe('Req: mint tokens\nCtx: {"industry":"retail"}\nAgain: mint tokens');
  });

  it('keeps doubled braces as literal braces', async () => {
    const prompt = PromptTemplate.fromTemplate('Return {{"a": {value}}}');
    expect(prompt.inputVariables).toEqual(['value']);
    await expect(prompt.format({ value: 1 })).resolves.toBe('Return {"a": 1}');
  });

  it('refuses to format with a missing value', async () => {
    const prompt = PromptTemplate.fromTemplate('Hello {name}');
    await expect(prompt.format({})).rejects.toThrow('Missing value for prompt variable "name"');
    await expect(prompt.format({ name: undefined })).rejects.toThrow(/Missing value/);
  });
});
