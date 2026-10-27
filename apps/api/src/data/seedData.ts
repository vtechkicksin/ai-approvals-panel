import path from 'node:path';
import type { ApprovalItem } from '@approvals/schemas';
import type { PriorityTable } from '../policy/priorityTable';

export const DATA_DIR = path.resolve(__dirname, '../../data');

export function loadApprovals(_file = path.join(DATA_DIR, 'approvals.json')): ApprovalItem[] {
  throw new Error('Not implemented');
}

export function loadPolicyMarkdown(_file = path.join(DATA_DIR, 'approval-policy.md')): string {
  throw new Error('Not implemented');
}

export function loadPriorityTable(_file?: string): PriorityTable {
  throw new Error('Not implemented');
}
