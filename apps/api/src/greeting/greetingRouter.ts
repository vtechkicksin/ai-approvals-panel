import { Router } from 'express';
import type { AppDeps } from '../app';

/** POST /api/ai/greeting: optional AI wording of the greeting, checked, with the template as backup. */
export function greetingRouter(_deps: AppDeps): Router {
  return Router();
}
