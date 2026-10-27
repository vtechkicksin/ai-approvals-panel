import { Router } from 'express';
import type { AppDeps } from '../app';

/** POST /api/ai/talk: streams a chat reply about the approvals queue as SSE. */
export function talkRouter(_deps: AppDeps): Router {
  return Router();
}
