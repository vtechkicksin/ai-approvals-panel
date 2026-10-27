import { create } from 'zustand';
import type { AnswerSource, Language, PolicyCitation } from '@approvals/schemas';

export type HelpStatus = 'idle' | 'streaming' | 'done' | 'error';

interface HelpData {
  question: string;
  status: HelpStatus;
  answer: string;
  citations: PolicyCitation[];
  notice: string | null;
  source: AnswerSource | null;
  errorMessage: string | null;
}

interface HelpActions {
  ask: (question: string, language: Language) => Promise<void>;
  retry: (language: Language) => Promise<void>;
  cancel: () => void;
}

export const initialHelpData: HelpData = {
  question: '',
  status: 'idle',
  answer: '',
  citations: [],
  notice: null,
  source: null,
  errorMessage: null,
};

export const useHelpStore = create<HelpData & HelpActions>()(() => ({
  ...initialHelpData,
  ask: async () => {
    throw new Error('Not implemented');
  },
  retry: async () => {
    throw new Error('Not implemented');
  },
  cancel: () => {},
}));
