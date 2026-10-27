import { create } from 'zustand';
import type { AnswerSource, Language, NoticeCode, SummaryCard, SummaryStreamEvent } from '@approvals/schemas';

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
export function applySummaryEvent(_state: SummaryData, _event: SummaryStreamEvent): SummaryData {
  throw new Error('Not implemented');
}

interface SummaryActions {
  /** Starts a new summary (cancelling any running one). */
  start: (language: Language) => Promise<void>;
  /** Stops the running summary, e.g. when the view closes. */
  cancel: () => void;
}

export const useSummaryStore = create<SummaryData & SummaryActions>()(() => ({
  ...initialSummaryData,
  start: async () => {
    throw new Error('Not implemented');
  },
  cancel: () => {},
}));
