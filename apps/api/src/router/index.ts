import { Router } from 'express';
import type { AppDeps } from '../app';
import { approvalsRouter } from './approvalsRouter';
import { greetingRouter } from './greetingRouter';
import { healthRouter } from './healthRouter';
import { helpRouter } from './helpRouter';
import { summaryRouter } from './summaryRouter';
import { talkRouter } from './talkRouter';
import { teachGuideRouter, teachRouter } from './teachRouter';

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
