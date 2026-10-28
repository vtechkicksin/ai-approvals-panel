import type { RequestHandler } from 'express';
import { approvalsResponseSchema } from '@approvals/schemas';
import type { ApprovalQueueDependencies } from '../../types/dependencies';
import { rankApprovals } from './rankApprovals';

export function approvalsController(deps: ApprovalQueueDependencies): RequestHandler {
  return (_req, res) => {
    const items = rankApprovals(deps.getApprovals(), deps.priorityTable);
    // Validate our own response against the contract before it leaves the server.
    res.json(approvalsResponseSchema.parse({ items, total: items.length }));
  };
}
