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
  const queue = { getApprovals: deps.getApprovals, priorityTable: deps.priorityTable };
  const queueWithAi = { ...queue, ai: deps.ai };
  const policyWithAi = { ai: deps.ai, policyChunks: deps.policyChunks };

  router.use('/api/health', healthRouter());
  router.use('/api/approvals', approvalsRouter(queue));
  router.use('/api/ai/summary', summaryRouter(queueWithAi));
  router.use('/api/ai/talk', talkRouter(queueWithAi));
  router.use('/api/ai/help', helpRouter(policyWithAi));
  router.use('/api/teach/guide', teachGuideRouter({ policyChunks: deps.policyChunks }));
  router.use('/api/ai/teach', teachRouter({ ...queue, ...policyWithAi }));
  router.use('/api/ai/greeting', greetingRouter(queueWithAi));
  return router;
}
