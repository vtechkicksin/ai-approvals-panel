import { Router } from 'express';
import type { AppDeps } from '../app';

/** POST /api/ai/help: answers a question from the policy, with citations, as SSE. */
export function helpRouter(_deps: AppDeps): Router {
  return Router();
}
