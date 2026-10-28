import { Router } from 'express';
import type { AppDeps } from '../../types/dependencies';
import { talkController } from './controller';

export function talkRouter(deps: AppDeps): Router {
  const router = Router();
  router.post('/', talkController(deps));
  return router;
}
