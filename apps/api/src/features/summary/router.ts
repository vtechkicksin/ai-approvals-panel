import { Router } from 'express';
import type { AppDeps } from '../../types/dependencies';
import { summaryController } from './controller';

export function summaryRouter(deps: AppDeps): Router {
  const router = Router();
  router.post('/', summaryController(deps));
  return router;
}
