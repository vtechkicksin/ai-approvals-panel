import express, { type Express } from 'express';
import { healthResponseSchema, type ApprovalItem, type HealthResponse } from '@approvals/schemas';
import { approvalsRouter } from './approvals/approvalsRouter';
import { loadApprovals, loadPriorityTable } from './data/seedData';
import { errorHandler, notFound } from './middleware/errors';
import type { PriorityTable } from './policy/priorityTable';

export interface AppDeps {
  getApprovals: () => ApprovalItem[];
  priorityTable: PriorityTable;
  /** The web app's origin, allowed to call the API from the browser. */
  webOrigin: string;
}

/** Loads the seed data once; invalid data or policy fails here, at startup. */
export function defaultDeps(): AppDeps {
  const approvals = loadApprovals();
  return {
    getApprovals: () => approvals,
    priorityTable: loadPriorityTable(),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  };
}

export function createApp(deps: AppDeps = defaultDeps()): Express {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = healthResponseSchema.parse({ status: 'ok' });
    res.json(body);
  });
  app.use('/api/approvals', approvalsRouter(deps));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
