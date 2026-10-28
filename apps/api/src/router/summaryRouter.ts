import { Router } from 'express';
import type { AppDeps } from '../app';
import { summaryController } from '../controller/summaryController';

export function summaryRouter(deps: AppDeps): Router {
  const router = Router();
  router.post('/', summaryController(deps));
  return router;
}
