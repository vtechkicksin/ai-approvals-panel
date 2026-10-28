import { Router } from 'express';
import { talkController, type TalkDependencies } from './controller';

export function talkRouter(deps: TalkDependencies): Router {
  const router = Router();
  router.post('/', talkController(deps));
  return router;
}
