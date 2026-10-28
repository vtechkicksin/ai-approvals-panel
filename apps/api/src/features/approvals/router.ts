import { Router } from 'express';
import type { AppDeps } from '../../types/dependencies';
import { approvalsController } from './controller';

export function approvalsRouter(deps: AppDeps): Router {
  const router = Router();
  router.get('/', approvalsController(deps));
  return router;
}
