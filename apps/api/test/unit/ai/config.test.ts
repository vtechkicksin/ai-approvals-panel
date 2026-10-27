import { loadAiConfig } from '../../../src/ai/config';

describe('loadAiConfig', () => {
  it('defaults to Gemini 2.5 Flash, an 8s first-word limit, a 5s silence limit and free-tier pricing', () => {
    expect(loadAiConfig({})).toMatchObject({
      model: 'gemini-2.5-flash',
      firstTokenTimeoutMs: 8000,
      idleTimeoutMs: 5000,
      pricePerMTok: { input: 0, output: 0 },
    });
  });

  it('can be tuned from environment variables', () => {
    const config = loadAiConfig({
      AI_MODEL: 'gemini-3.5-flash',
      AI_FIRST_TOKEN_TIMEOUT_MS: '6000',
      AI_IDLE_TIMEOUT_MS: '3000',
      AI_PRICE_INPUT_PER_MTOK: '0.3',
      AI_PRICE_OUTPUT_PER_MTOK: '2.5',
    });

    expect(config).toMatchObject({
      model: 'gemini-3.5-flash',
      firstTokenTimeoutMs: 6000,
      idleTimeoutMs: 3000,
      pricePerMTok: { input: 0.3, output: 2.5 },
    });
  });

  it('fails at startup on a bad value instead of misbehaving later', () => {
    expect(() => loadAiConfig({ AI_FIRST_TOKEN_TIMEOUT_MS: 'soon' })).toThrow(/AI_FIRST_TOKEN_TIMEOUT_MS/);
    expect(() => loadAiConfig({ AI_IDLE_TIMEOUT_MS: '-5' })).toThrow(/AI_IDLE_TIMEOUT_MS/);
    expect(() => loadAiConfig({ AI_PRICE_INPUT_PER_MTOK: '-1' })).toThrow(/AI_PRICE_INPUT_PER_MTOK/);
  });
});
