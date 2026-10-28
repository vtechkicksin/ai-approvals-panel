import { PRIORITY_LEVELS, type ApprovalItem, type PriorityLevel, type RankedApproval } from '@approvals/schemas';
import type { PriorityTable } from '../../policy/priorityTable';

const DEFAULT_PRIORITY: PriorityLevel = 'medium';

type Prioritised = Omit<RankedApproval, 'rank'>;

function prioritise(item: ApprovalItem, table: PriorityTable): Prioritised {
  if (item.priority) {
    return {
      ...item,
      effectivePriority: item.priority,
      prioritySource: 'item_override',
      priorityReason: `Marked ${item.priority} by the submitter, which overrides the policy.`,
    };
  }
  const rule = table.get(item.category.toLowerCase());
  if (rule) {
    return { ...item, effectivePriority: rule.priority, prioritySource: 'policy', priorityReason: rule.reason };
  }
  return {
    ...item,
    effectivePriority: DEFAULT_PRIORITY,
    prioritySource: 'default',
    priorityReason: `Category "${item.category}" is not listed in the policy, so it gets the default priority (${DEFAULT_PRIORITY}).`,
  };
}

/**
 * Deterministic queue order: the item's own priority wins, then the policy
 * table, then a medium default. Ties go to the oldest item, then by title.
 * The AI explains this order; it never decides it.
 */
export function rankApprovals(items: readonly ApprovalItem[], table: PriorityTable): RankedApproval[] {
  return items
    .map((item) => prioritise(item, table))
    .sort(
      (a, b) =>
        PRIORITY_LEVELS.indexOf(a.effectivePriority) - PRIORITY_LEVELS.indexOf(b.effectivePriority) ||
        Date.parse(a.submittedAt) - Date.parse(b.submittedAt) ||
        a.title.localeCompare(b.title),
    )
    .map((item, index) => ({ ...item, rank: index + 1 }));
}
