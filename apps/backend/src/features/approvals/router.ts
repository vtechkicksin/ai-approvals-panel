import { Router } from 'express';
import type { ApprovalQueueDependencies } from '../../types/dependencies';
import { approvalsController } from './controller';

export function approvalsRouter(deps: ApprovalQueueDependencies): Router {
  const router = Router();
  router.get('/', approvalsController(deps));
  return router;
}
