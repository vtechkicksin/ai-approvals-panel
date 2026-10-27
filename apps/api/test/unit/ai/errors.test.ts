import { AiNotConfiguredError, classifyAiError, isRetryable } from '../../../src/ai/errors';

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

describe('classifyAiError', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate_limited'],
    [400, 'bad_request'],
    [404, 'bad_request'],
    [413, 'bad_request'],
    [500, 'unavailable'],
    [502, 'unavailable'],
    [503, 'unavailable'],
    [529, 'unavailable'],
  ])('maps HTTP %i to %s', (status, reason) => {
    expect(classifyAiError(httpError(status))).toBe(reason);
  });

  it('treats a missing API key as not configured', () => {
    expect(classifyAiError(new AiNotConfiguredError())).toBe('not_configured');
  });

  it('treats network failures as unavailable', () => {
    expect(classifyAiError(new TypeError('fetch failed'))).toBe('unavailable');
    expect(classifyAiError(Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' }))).toBe(
      'unavailable',
    );
  });

  it('treats an abort as cancelled', () => {
    expect(classifyAiError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe('cancelled');
  });

  it('never throws on strange values', () => {
    expect(classifyAiError('boom')).toBe('unknown');
    expect(classifyAiError(undefined)).toBe('unknown');
    expect(classifyAiError({ status: 'weird' })).toBe('unknown');
  });
});

describe('isRetryable', () => {
  it('retries only temporary service problems', () => {
    expect(isRetryable('unavailable')).toBe(true);
    for (const reason of ['auth', 'rate_limited', 'bad_request', 'not_configured', 'cancelled', 'unknown'] as const) {
      expect(isRetryable(reason)).toBe(false);
    }
  });

  it('never retries after a timeout, so the user never waits past the limit', () => {
    expect(isRetryable('first_token_timeout')).toBe(false);
    expect(isRetryable('stalled')).toBe(false);
  });
});
