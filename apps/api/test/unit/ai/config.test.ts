import { loadAiConfig } from '../../../src/ai/config';

describe('loadAiConfig', () => {
  it('defaults to Gemini 3.1 Flash-Lite, an 8s first-word limit, a 5s silence limit and free-tier pricing', () => {
    expect(loadAiConfig({})).toMatchObject({
      // Free tier: gemini-2.5-flash allows only 20 requests/day; 3.1 Flash-Lite has its own quota and is faster.
      model: 'gemini-3.1-flash-lite',
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

  it('can point at another Gemini endpoint (used by the end-to-end tests)', () => {
    expect(loadAiConfig({}).baseUrl).toBeUndefined();
    expect(loadAiConfig({ AI_BASE_URL: 'http://localhost:4900' }).baseUrl).toBe('http://localhost:4900');
    expect(() => loadAiConfig({ AI_BASE_URL: 'not a url' })).toThrow(/AI_BASE_URL/);
  });

  it('limits AI requests to 20 a minute per session, with a 60 a minute backstop per IP', () => {
    expect(loadAiConfig({})).toMatchObject({ rateLimitPerMinute: 20, rateLimitPerIpPerMinute: 60 });
    expect(
      loadAiConfig({ AI_RATE_LIMIT_PER_MINUTE: '5', AI_RATE_LIMIT_PER_IP_PER_MINUTE: '15' }),
    ).toMatchObject({ rateLimitPerMinute: 5, rateLimitPerIpPerMinute: 15 });
    expect(() => loadAiConfig({ AI_RATE_LIMIT_PER_MINUTE: '0' })).toThrow(/AI_RATE_LIMIT_PER_MINUTE/);
  });
});
