import { Router } from 'express';
import type { AppDeps } from '../app';
import { teachController, teachGuideController } from '../controller/teachController';

export function teachGuideRouter(deps: AppDeps): Router {
  const router = Router();
  router.get('/', teachGuideController(deps));
  return router;
}

export function teachRouter(deps: AppDeps): Router {
  const router = Router();
  router.post('/', teachController(deps));
  return router;
}
