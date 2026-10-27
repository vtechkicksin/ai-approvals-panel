import type { ApprovalItem, RankedApproval } from '@approvals/schemas';
import type { PriorityTable } from '../policy/priorityTable';

export function rankApprovals(_items: readonly ApprovalItem[], _table: PriorityTable): RankedApproval[] {
  throw new Error('Not implemented');
}
