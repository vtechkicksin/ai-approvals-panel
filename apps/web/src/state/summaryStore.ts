import { create } from 'zustand';
import {
  summaryStreamEventSchema,
  type AnswerSource,
  type Language,
  type NoticeCode,
  type SummaryCard,
  type SummaryStreamEvent,
} from '@approvals/schemas';
import { ApiClientError, isAbort } from '../api/client';
import { streamSse } from '../api/sseClient';

export type SummaryStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

export interface SummaryData {
  status: SummaryStatus;
  cards: SummaryCard[];
  headline: string;
  /** AI or rule-based reason per card id. */
  reasons: Record<string, string>;
  /** Cards whose reason passed the server's check (or was replaced by rules). */
  confirmed: Record<string, 'ok' | 'fallback'>;
  spokenScript: string;
  notice: { code: NoticeCode; message: string } | null;
  source: AnswerSource | null;
  errorMessage: string | null;
}

export const initialSummaryData: SummaryData = {
  status: 'idle',
  cards: [],
  headline: '',
  reasons: {},
  confirmed: {},
  spokenScript: '',
  notice: null,
  source: null,
  errorMessage: null,
};

/** Pure: how one stream event changes the summary state. */
export function applySummaryEvent(state: SummaryData, event: SummaryStreamEvent): SummaryData {
  const onScreen = (id: string) => state.cards.some((c) => c.id === id);

  switch (event.type) {
    case 'skeleton':
      return { ...state, status: 'streaming', cards: event.items };
    case 'delta':
      if (event.field === 'headline') return { ...state, headline: state.headline + event.text };
      if (event.field === 'spokenScript') return { ...state, spokenScript: state.spokenScript + event.text };
      if (!event.itemId || !onScreen(event.itemId) || state.confirmed[event.itemId]) return state;
      return {
        ...state,
        reasons: { ...state.reasons, [event.itemId]: (state.reasons[event.itemId] ?? '') + event.text },
      };
    case 'item':
      if (!onScreen(event.itemId)) return state;
      return {
        ...state,
        reasons: { ...state.reasons, [event.itemId]: event.reason },
        confirmed: { ...state.confirmed, [event.itemId]: event.status },
      };
    case 'notice':
      return { ...state, notice: { code: event.code, message: event.message } };
    case 'complete': {
      // The validated final summary replaces all provisional streamed text.
      const visible = event.summary.items.filter((i) => onScreen(i.id));
      return {
        ...state,
        status: 'complete',
        source: event.source,
        headline: event.summary.headline,
        spokenScript: event.summary.spokenScript,
        reasons: Object.fromEntries(visible.map((i) => [i.id, i.reason])),
        confirmed: Object.fromEntries(visible.map((i) => [i.id, 'ok' as const])),
      };
    }
    case 'error':
      return { ...state, status: 'error', errorMessage: event.message };
  }
}

interface SummaryActions {
  /** Starts a new summary (cancelling any running one). */
  start: (language: Language) => Promise<void>;
  /** Stops the running summary, e.g. when the view closes. */
  cancel: () => void;
}

let running: AbortController | null = null;

export const useSummaryStore = create<SummaryData & SummaryActions>()((set) => ({
  ...initialSummaryData,

  start: async (language) => {
    running?.abort();
    const run = new AbortController();
    running = run;
    set({ ...initialSummaryData, status: 'connecting' });

    try {
      await streamSse({
        path: '/api/ai/summary',
        body: { language },
        schema: summaryStreamEventSchema,
        isTerminal: (e) => e.type === 'complete' || e.type === 'error',
        onEvent: (event) => {
          if (running === run) set((state) => applySummaryEvent(state, event));
        },
        signal: run.signal,
      });
    } catch (err) {
      if (running !== run || isAbort(err)) return;
      set({
        status: 'error',
        errorMessage: err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.',
      });
    }
  },

  cancel: () => {
    running?.abort();
    running = null;
  },
}));
