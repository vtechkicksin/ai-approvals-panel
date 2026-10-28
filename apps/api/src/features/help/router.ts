import { Router } from 'express';
import type { AppDeps } from '../../types/dependencies';
import { helpController } from './controller';

export function helpRouter(deps: AppDeps): Router {
  const router = Router();
  router.post('/', helpController(deps));
  return router;
}
