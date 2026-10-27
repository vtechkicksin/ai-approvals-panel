import type { Language, RankedApproval } from '@approvals/schemas';

export interface TalkPromptInput {
  ranked: readonly RankedApproval[];
  language: Language;
  /** ISO date, e.g. "2026-10-27". */
  today: string;
}

export const talkPromptV1 = {
  id: 'talk',
  version: 1,
  buildSystem(_input: TalkPromptInput): string {
    throw new Error('Not implemented');
  },
} as const;
