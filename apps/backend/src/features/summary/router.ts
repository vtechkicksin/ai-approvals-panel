import { Router } from 'express';
import { summaryController, type SummaryDependencies } from './controller';

export function summaryRouter(deps: SummaryDependencies): Router {
  const router = Router();
  router.post('/', summaryController(deps));
  return router;
}
