import { create } from 'zustand';
import {
  helpStreamEventSchema,
  type AnswerSource,
  type HelpStreamEvent,
  type Language,
  type PolicyCitation,
} from '@approvals/schemas';
import { ApiClientError, isAbort } from '../api/client';
import { streamSse } from '../api/sseClient';

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

/** Pure: how one stream event changes the answer. */
export function applyHelpEvent(state: HelpData, event: HelpStreamEvent): HelpData {
  switch (event.type) {
    case 'citations':
      return { ...state, citations: event.items };
    case 'token':
      return { ...state, answer: state.answer + event.text };
    case 'notice':
      return { ...state, notice: event.message };
    case 'fallback':
      return { ...state, answer: event.text };
    case 'done':
      return { ...state, status: 'done', source: event.source };
    case 'error':
      return { ...state, status: 'error', errorMessage: event.message };
  }
}

let running: AbortController | null = null;

export const useHelpStore = create<HelpData & HelpActions>()((set, get) => ({
  ...initialHelpData,

  ask: async (text, language) => {
    const question = text.trim();
    if (!question) return;
    running?.abort();
    const run = new AbortController();
    running = run;
    set({ ...initialHelpData, question, status: 'streaming' });

    try {
      await streamSse({
        path: '/api/ai/help',
        body: { language, question },
        schema: helpStreamEventSchema,
        isTerminal: (e) => e.type === 'done' || e.type === 'error',
        onEvent: (event) => {
          if (running === run) set((s) => applyHelpEvent(s, event));
        },
        signal: run.signal,
      });
    } catch (err) {
      if (running !== run || isAbort(err)) return;
      set({
        status: 'error',
        errorMessage: err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.',
      });
    } finally {
      if (running === run) running = null;
    }
  },

  retry: (language) => get().ask(get().question, language),

  cancel: () => {
    running?.abort();
    running = null;
    if (get().status === 'streaming') set({ status: 'idle' });
  },
}));
