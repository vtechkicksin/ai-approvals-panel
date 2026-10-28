import { Router } from 'express';
import type { AppDeps } from '../app';
import { greetingController } from '../controller/greetingController';

export function greetingRouter(deps: AppDeps): Router {
  const router = Router();
  router.post('/', greetingController(deps));
  return router;
}
