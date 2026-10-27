import {
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIRequestInputError,
  GoogleGenerativeAIResponseError,
} from '@google/generative-ai';

/** Why an AI call did not finish normally. */
export type AiFailureReason =
  | 'first_token_timeout'
  | 'stalled'
  | 'auth'
  | 'rate_limited'
  | 'unavailable'
  | 'bad_request'
  | 'not_configured'
  | 'cancelled'
  | 'unknown';

export class AiNotConfiguredError extends Error {
  override name = 'AiNotConfiguredError';
  constructor() {
    super('GOOGLE_API_KEY is not set');
  }
}

function byStatus(status: number): AiFailureReason {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'unavailable';
  if (status >= 400) return 'bad_request';
  return 'unknown';
}

/** Maps any thrown value from an AI call to a reason we can act on. Never throws. */
export function classifyAiError(err: unknown): AiFailureReason {
  if (err instanceof AiNotConfiguredError) return 'not_configured';
  if (err instanceof GoogleGenerativeAIAbortError) return 'cancelled';
  if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
  if (err instanceof GoogleGenerativeAIFetchError) return typeof err.status === 'number' ? byStatus(err.status) : 'unknown';
  // Blocked reply (e.g. safety) or a request the SDK rejected before sending.
  if (err instanceof GoogleGenerativeAIResponseError || err instanceof GoogleGenerativeAIRequestInputError) {
    return 'bad_request';
  }
  // The SDK wraps a failed fetch (network down, connection reset) in a plain GoogleGenerativeAIError.
  if (err instanceof GoogleGenerativeAIError || err instanceof TypeError) return 'unavailable';

  const status = typeof err === 'object' && err !== null ? (err as { status?: unknown }).status : undefined;
  return typeof status === 'number' ? byStatus(status) : 'unknown';
}

/**
 * Quick, temporary failures worth one more try. Timeouts are never retried:
 * the user has already waited the full limit. 429 (free-tier quota) is not
 * retried either: a second call would only use up more quota.
 */
export function isRetryable(reason: AiFailureReason): boolean {
  return reason === 'unavailable';
}
