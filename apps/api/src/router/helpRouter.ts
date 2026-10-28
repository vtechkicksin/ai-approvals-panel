import { Router } from 'express';
import type { AppDeps } from '../app';
import { helpController } from '../controller/helpController';

export function helpRouter(deps: AppDeps): Router {
  const router = Router();
  router.post('/', helpController(deps));
  return router;
}
