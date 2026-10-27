import { z } from 'zod';

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

const ms = z.coerce.number().int().positive();

const envSchema = z.object({
  AI_MODEL: z.string().min(1).default('claude-haiku-5-5'),
  AI_FIRST_TOKEN_TIMEOUT_MS: ms.default(8000),
  AI_IDLE_TIMEOUT_MS: ms.default(5000),
  AI_MIN_RETRY_WINDOW_MS: ms.default(1500),
  AI_MAX_TOKENS: ms.default(1024),
});

/** Reads AI settings from the environment. A bad value fails at startup with its name. */
export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid AI settings:\n${z.prettifyError(parsed.error)}`);
  const e = parsed.data;
  return {
    model: e.AI_MODEL,
    firstTokenTimeoutMs: e.AI_FIRST_TOKEN_TIMEOUT_MS,
    idleTimeoutMs: e.AI_IDLE_TIMEOUT_MS,
    minRetryWindowMs: e.AI_MIN_RETRY_WINDOW_MS,
    maxTokens: e.AI_MAX_TOKENS,
  };
}
