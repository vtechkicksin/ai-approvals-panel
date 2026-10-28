import { Router } from 'express';
import type { AppDeps } from '../../types/dependencies';
import { teachController, teachGuideController } from './controller';

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
