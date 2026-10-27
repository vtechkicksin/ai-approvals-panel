import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { approvalItemSchema, type ApprovalItem } from '@approvals/schemas';
import { parsePriorityTable, type PriorityTable } from '../policy/priorityTable';

export const DATA_DIR = path.resolve(__dirname, '../../data');

/** Reads and validates the seed queue. Bad data fails at startup, not mid-request. */
export function loadApprovals(file = path.join(DATA_DIR, 'approvals.json')): ApprovalItem[] {
  const parsed = z.array(approvalItemSchema).safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) {
    throw new Error(`Invalid approvals data in ${file}:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export function loadPolicyMarkdown(file = path.join(DATA_DIR, 'approval-policy.md')): string {
  return readFileSync(file, 'utf8');
}

export function loadPriorityTable(file?: string): PriorityTable {
  return parsePriorityTable(loadPolicyMarkdown(file));
}
