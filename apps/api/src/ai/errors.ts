import { APIConnectionError } from '@anthropic-ai/sdk';

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
    super('ANTHROPIC_API_KEY is not set');
  }
}

function field(err: unknown, key: string): unknown {
  return typeof err === 'object' && err !== null ? (err as Record<string, unknown>)[key] : undefined;
}

/** Maps any thrown value from an AI call to a reason we can act on. Never throws. */
export function classifyAiError(err: unknown): AiFailureReason {
  if (err instanceof AiNotConfiguredError) return 'not_configured';

  if (field(err, 'name') === 'AbortError') return 'cancelled';
  // Network down / connection reset / SDK connection timeout.
  if (err instanceof APIConnectionError || err instanceof TypeError) return 'unavailable';

  const status = field(err, 'status');
  if (typeof status !== 'number') return 'unknown';
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'unavailable';
  if (status >= 400) return 'bad_request';
  return 'unknown';
}

/**
 * Quick, temporary failures worth one more try. Timeouts are never retried:
 * the user has already waited the full limit.
 */
export function isRetryable(reason: AiFailureReason): boolean {
  return reason === 'unavailable';
}
