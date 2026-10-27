import type { PriorityLevel } from '@approvals/schemas';

export interface PriorityRule {
  priority: PriorityLevel;
  reason: string;
}

/** Category (lower-case) → default priority, read from the policy doc. */
export type PriorityTable = ReadonlyMap<string, PriorityRule>;

export class PolicyFormatError extends Error {
  override name = 'PolicyFormatError';
}

export function parsePriorityTable(_markdown: string): PriorityTable {
  throw new Error('Not implemented');
}
