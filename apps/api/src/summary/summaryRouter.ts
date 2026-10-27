import { Router } from 'express';
import type { AppDeps } from '../app';

/** POST /api/ai/summary: streams the prioritised queue summary as SSE. */
export function summaryRouter(_deps: AppDeps): Router {
  const router = Router();
  return router;
}
