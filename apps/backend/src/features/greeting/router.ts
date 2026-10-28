import { Router } from 'express';
import { greetingController, type GreetingDependencies } from './controller';

export function greetingRouter(deps: GreetingDependencies): Router {
  const router = Router();
  router.post('/', greetingController(deps));
  return router;
}
