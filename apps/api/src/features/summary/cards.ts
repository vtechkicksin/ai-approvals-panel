import type { RankedApproval, SummaryCard } from '@approvals/schemas';

/** The parts of each ranked item the summary cards show. */
export function toCards(ranked: readonly RankedApproval[]): SummaryCard[] {
  return ranked.map(({ id, rank, title, type, effectivePriority, priorityReason }) => ({
    id,
    rank,
    title,
    type,
    effectivePriority,
    priorityReason,
  }));
}
