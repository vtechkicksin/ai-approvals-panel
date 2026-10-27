import { Router } from 'express';
import { approvalsResponseSchema, type ApprovalItem } from '@approvals/schemas';
import type { PriorityTable } from '../policy/priorityTable';
import { rankApprovals } from './rankApprovals';

export function approvalsRouter(deps: { getApprovals: () => ApprovalItem[]; priorityTable: PriorityTable }): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const items = rankApprovals(deps.getApprovals(), deps.priorityTable);
    // Validate our own response against the contract before it leaves the server.
    res.json(approvalsResponseSchema.parse({ items, total: items.length }));
  });

  return router;
}
