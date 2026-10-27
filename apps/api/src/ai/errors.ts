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

export function classifyAiError(_err: unknown): AiFailureReason {
  throw new Error('Not implemented');
}

/** Quick, temporary failures worth one more try. */
export function isRetryable(_reason: AiFailureReason): boolean {
  throw new Error('Not implemented');
}
