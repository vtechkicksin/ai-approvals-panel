import type { RequestHandler } from 'express';
import type { AiConfig } from '../ai/config';

/** Per-session limit on the AI endpoints, with a per-IP backstop. */
export function aiRateLimit(_config: AiConfig): RequestHandler[] {
  return []; // Not implemented yet
}
