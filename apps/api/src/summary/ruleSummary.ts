import type { Language, Summary, SummaryCard } from '@approvals/schemas';

/** The rule-based summary: used when the AI fails, and when there is nothing for the AI to do. */
export function buildRuleSummary(_cards: readonly SummaryCard[], _language: Language): Summary {
  throw new Error('Not implemented');
}
