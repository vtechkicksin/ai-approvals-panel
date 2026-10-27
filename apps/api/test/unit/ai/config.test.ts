import { loadAiConfig } from '../../../src/ai/config';

describe('loadAiConfig', () => {
  it('defaults to Haiku 5.5, an 8s first-word limit and a 5s silence limit', () => {
    expect(loadAiConfig({})).toMatchObject({
      model: 'claude-haiku-5-5',
      firstTokenTimeoutMs: 8000,
      idleTimeoutMs: 5000,
    });
  });

  it('can be tuned from environment variables', () => {
    const config = loadAiConfig({
      AI_MODEL: 'claude-sonnet-5-5',
      AI_FIRST_TOKEN_TIMEOUT_MS: '6000',
      AI_IDLE_TIMEOUT_MS: '3000',
    });

    expect(config).toMatchObject({ model: 'claude-sonnet-5-5', firstTokenTimeoutMs: 6000, idleTimeoutMs: 3000 });
  });

  it('fails at startup on a bad value instead of misbehaving later', () => {
    expect(() => loadAiConfig({ AI_FIRST_TOKEN_TIMEOUT_MS: 'soon' })).toThrow(/AI_FIRST_TOKEN_TIMEOUT_MS/);
    expect(() => loadAiConfig({ AI_IDLE_TIMEOUT_MS: '-5' })).toThrow(/AI_IDLE_TIMEOUT_MS/);
  });
});
