import { Router } from 'express';
import type { AppDeps } from '../app';
import { talkController } from '../controller/talkController';

export function talkRouter(deps: AppDeps): Router {
  const router = Router();
  router.post('/', talkController(deps));
  return router;
}
