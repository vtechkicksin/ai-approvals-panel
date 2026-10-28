import { Router } from 'express';
import type { AppDeps } from '../app';
import { approvalsController } from '../controller/approvalsController';

export function approvalsRouter(deps: AppDeps): Router {
  const router = Router();
  router.get('/', approvalsController(deps));
  return router;
}
