import type { Request, RequestHandler, Response } from 'express';
import { ipKeyGenerator, rateLimit, type Options, type RateLimitInfo } from 'express-rate-limit';
import { languageSchema, type Language } from '@approvals/schemas';
import type { AiConfig } from '../ai/config';
import { errorBody } from './errors';

const WINDOW_MS = 60_000;

const WAIT_MESSAGE: Record<Language, (seconds: number) => string> = {
  en: (s) => `You're sending requests quickly. Please wait about ${s} seconds and try again.`,
  hi: (s) => `आप बहुत जल्दी-जल्दी अनुरोध भेज रहे हैं। कृपया लगभग ${s} सेकंड रुककर फिर से कोशिश करें।`,
};

/** A friendly JSON 429 in the usual error shape, saying how long to wait, in the request's language. */
function tooMany(req: Request, res: Response, _next: unknown, options: Options) {
  // express-rate-limit puts its counter info on the request.
  const info = (req as Request & { rateLimit?: RateLimitInfo }).rateLimit;
  const resetAt = info?.resetTime?.getTime() ?? Date.now() + options.windowMs;
  const seconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  const language = languageSchema.safeParse((req.body as { language?: unknown } | undefined)?.language);
  res.setHeader('Retry-After', String(seconds));
  res.status(429).json(errorBody('rate_limited', WAIT_MESSAGE[language.success ? language.data : 'en'](seconds)));
}

/**
 * Limits on the AI endpoints, where every request can cost tokens:
 * - per browser session (the anonymous cookie): the real limit
 * - per IP address: a backstop, since clearing the cookie starts a new session
 * Counters live in memory; with several API instances this would be a Redis store.
 */
export function aiRateLimit(config: AiConfig): RequestHandler[] {
  const common = { windowMs: WINDOW_MS, standardHeaders: 'draft-8', legacyHeaders: false, handler: tooMany } as const;
  return [
    rateLimit({ ...common, limit: config.rateLimitPerIpPerMinute }),
    rateLimit({
      ...common,
      limit: config.rateLimitPerMinute,
      keyGenerator: (req) => req.sessionId ?? ipKeyGenerator(req.ip ?? ''),
    }),
  ];
}
