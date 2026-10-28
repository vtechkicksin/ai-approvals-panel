import { Router } from 'express';
import type { AppDeps } from '../../types/dependencies';
import { greetingController } from './controller';

export function greetingRouter(deps: AppDeps): Router {
  const router = Router();
  router.post('/', greetingController(deps));
  return router;
}
