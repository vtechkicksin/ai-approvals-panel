import type { Language, RankedApproval, TeachStep } from '@approvals/schemas';
import type { PolicyChunk } from '../help/policyChunks';

export interface TeachPromptInput {
  steps: readonly TeachStep[];
  current: TeachStep;
  sections: readonly PolicyChunk[];
  /** The live queue, so explanations can use real examples. */
  ranked: readonly RankedApproval[];
  language: Language;
}

export const teachPromptV1 = {
  id: 'teach',
  version: 1,
  buildSystem(_input: TeachPromptInput): string {
    throw new Error('Not implemented');
  },
} as const;
