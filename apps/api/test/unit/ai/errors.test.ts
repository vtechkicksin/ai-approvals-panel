import {
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIResponseError,
} from '@google/generative-ai';
import { AiNotConfiguredError, classifyAiError, isRetryable } from '../../../src/ai/errors';

const fetchError = (status: number) => new GoogleGenerativeAIFetchError(`HTTP ${status}`, status, 'status text');

describe('classifyAiError (Gemini)', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate_limited'],
    [400, 'bad_request'],
    [404, 'bad_request'],
    [500, 'unavailable'],
    [503, 'unavailable'],
    [504, 'unavailable'],
  ])('maps HTTP %i to %s', (status, reason) => {
    expect(classifyAiError(fetchError(status))).toBe(reason);
  });

  it('treats a missing API key as not configured', () => {
    expect(classifyAiError(new AiNotConfiguredError())).toBe('not_configured');
  });

  it('treats network failures as unavailable', () => {
    // What the Google SDK throws when fetch itself fails: no status.
    expect(classifyAiError(new GoogleGenerativeAIError('Error fetching from ...: fetch failed'))).toBe('unavailable');
    expect(classifyAiError(new TypeError('fetch failed'))).toBe('unavailable');
  });

  it('treats a reply blocked by Gemini (e.g. safety) as a bad request', () => {
    expect(classifyAiError(new GoogleGenerativeAIResponseError('Candidate was blocked due to SAFETY'))).toBe(
      'bad_request',
    );
  });

  it('treats an abort as cancelled', () => {
    expect(classifyAiError(new GoogleGenerativeAIAbortError('Request aborted'))).toBe('cancelled');
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
