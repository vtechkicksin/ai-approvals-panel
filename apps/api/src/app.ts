import express, { type Express } from 'express';
import { healthResponseSchema, type ApprovalItem, type HealthResponse } from '@approvals/schemas';
import type { PriorityTable } from './policy/priorityTable';

export interface AppDeps {
  getApprovals: () => ApprovalItem[];
  priorityTable: PriorityTable;
}

export function createApp(_deps?: AppDeps): Express {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = healthResponseSchema.parse({ status: 'ok' });
    res.json(body);
  });

  return app;
}
