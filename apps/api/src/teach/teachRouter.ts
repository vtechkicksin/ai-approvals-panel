import { Router } from 'express';
import type { AppDeps } from '../app';

/** GET /api/teach/guide: the fixed guide (no AI). */
export function teachGuideRouter(_deps: AppDeps): Router {
  return Router();
}

/** POST /api/ai/teach: streams an answer to a follow-up question about one step. */
export function teachRouter(_deps: AppDeps): Router {
  return Router();
}
