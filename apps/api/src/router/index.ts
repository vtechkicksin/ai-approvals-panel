import { Router } from 'express';
import type { AppDeps } from '../types/dependencies';
import { approvalsRouter } from '../features/approvals/router';
import { greetingRouter } from '../features/greeting/router';
import { healthRouter } from './healthRouter';
import { helpRouter } from '../features/help/router';
import { summaryRouter } from '../features/summary/router';
import { talkRouter } from '../features/talk/router';
import { teachGuideRouter, teachRouter } from '../features/teach/router';

/** Registers the API's feature routers and their public URL prefixes. */
export function apiRouter(deps: AppDeps): Router {
  const router = Router();
  router.use('/api/health', healthRouter());
  router.use('/api/approvals', approvalsRouter(deps));
  router.use('/api/ai/summary', summaryRouter(deps));
  router.use('/api/ai/talk', talkRouter(deps));
  router.use('/api/ai/help', helpRouter(deps));
  router.use('/api/teach/guide', teachGuideRouter(deps));
  router.use('/api/ai/teach', teachRouter(deps));
  router.use('/api/ai/greeting', greetingRouter(deps));
  return router;
}
