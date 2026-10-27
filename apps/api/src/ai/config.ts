export interface AiConfig {
  model: string;
  /** Max wait for the first word, including one quick retry. */
  firstTokenTimeoutMs: number;
  /** Max silence between words once the reply has started. */
  idleTimeoutMs: number;
  /** A retry is only attempted if at least this much of the first-token budget is left. */
  minRetryWindowMs: number;
  maxTokens: number;
}

export function loadAiConfig(_env: NodeJS.ProcessEnv = process.env): AiConfig {
  throw new Error('Not implemented');
}
