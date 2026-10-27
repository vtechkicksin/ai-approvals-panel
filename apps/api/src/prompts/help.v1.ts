import type { Language } from '@approvals/schemas';
import type { PolicyChunk } from '../help/policyChunks';

export interface HelpPromptInput {
  question: string;
  chunks: readonly PolicyChunk[];
  language: Language;
}

export const helpPromptV1 = {
  id: 'help',
  version: 1,
  build(_input: HelpPromptInput): { system: string; user: string } {
    throw new Error('Not implemented');
  },
} as const;
