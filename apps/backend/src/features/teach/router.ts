import { Router } from 'express';
import {
  teachController,
  teachGuideController,
  type TeachDependencies,
  type TeachGuideDependencies,
} from './controller';

export function teachGuideRouter(deps: TeachGuideDependencies): Router {
  const router = Router();
  router.get('/', teachGuideController(deps));
  return router;
}

export function teachRouter(deps: TeachDependencies): Router {
  const router = Router();
  router.post('/', teachController(deps));
  return router;
}
