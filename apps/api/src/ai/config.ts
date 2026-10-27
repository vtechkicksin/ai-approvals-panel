import { z } from 'zod';
import type { PricePerMTok } from './pricing';

export interface AiConfig {
  model: string;
  /** Max wait for the first word, including one quick retry. */
  firstTokenTimeoutMs: number;
  /** Max silence between words once the reply has started. */
  idleTimeoutMs: number;
  /** A retry is only attempted if at least this much of the first-token budget is left. */
  minRetryWindowMs: number;
  maxTokens: number;
  /** For the cost log. Defaults to 0 (free tier). */
  pricePerMTok: PricePerMTok;
  /** Another Gemini endpoint (e.g. the fake one in end-to-end tests); undefined = Google. */
  baseUrl?: string;
}

const ms = z.coerce.number().int().positive();
const price = z.coerce.number().nonnegative();

const envSchema = z.object({
  // gemini-2.5-flash's free tier allows only 20 requests a day; 3.1 Flash-Lite has its own quota
  // and measured faster (first word ~0.7-1.6s in English).
  AI_MODEL: z.string().min(1).default('gemini-3.1-flash-lite'),
  AI_FIRST_TOKEN_TIMEOUT_MS: ms.default(8000),
  AI_IDLE_TIMEOUT_MS: ms.default(5000),
  AI_MIN_RETRY_WINDOW_MS: ms.default(1500),
  AI_MAX_TOKENS: ms.default(1024),
  AI_PRICE_INPUT_PER_MTOK: price.default(0),
  AI_PRICE_OUTPUT_PER_MTOK: price.default(0),
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
    pricePerMTok: { input: e.AI_PRICE_INPUT_PER_MTOK, output: e.AI_PRICE_OUTPUT_PER_MTOK },
  };
}
