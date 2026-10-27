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

/** Maps any thrown value from an AI call to a reason we can act on. Never throws. */
export function classifyAiError(_err: unknown): AiFailureReason {
  throw new Error('Not implemented');
}

/**
 * Quick, temporary failures worth one more try. Timeouts are never retried:
 * the user has already waited the full limit.
 */
export function isRetryable(reason: AiFailureReason): boolean {
  return reason === 'unavailable';
}
