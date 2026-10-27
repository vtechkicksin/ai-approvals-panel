import type { Language, SummaryCard } from '@approvals/schemas';

export interface SummaryPromptInput {
  cards: readonly SummaryCard[];
  language: Language;
  /** ISO date, e.g. "2026-10-27", so the model can describe how old items are. */
  today: string;
  /** submittedAt / submittedBy per card id, for context. */
  details: Readonly<Record<string, { submittedBy: string; submittedAt: string }>>;
}

export const summaryPromptV1 = {
  id: 'summary',
  version: 1,
  build(_input: SummaryPromptInput): { system: string; user: string } {
    throw new Error('Not implemented');
  },
} as const;
