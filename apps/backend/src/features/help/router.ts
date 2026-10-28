import { Router } from 'express';
import { helpController, type HelpDependencies } from './controller';

export function helpRouter(deps: HelpDependencies): Router {
  const router = Router();
  router.post('/', helpController(deps));
  return router;
}
