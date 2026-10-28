import type { RequestHandler } from 'express';
import { approvalsResponseSchema, type ApprovalItem } from '@approvals/schemas';
import type { PriorityTable } from '../policy/priorityTable';
import { rankApprovals } from '../approvals/rankApprovals';

export function approvalsController(deps: { getApprovals: () => ApprovalItem[]; priorityTable: PriorityTable }): RequestHandler {
  return (_req, res) => {
    const items = rankApprovals(deps.getApprovals(), deps.priorityTable);
    // Validate our own response against the contract before it leaves the server.
    res.json(approvalsResponseSchema.parse({ items, total: items.length }));
  };
}
