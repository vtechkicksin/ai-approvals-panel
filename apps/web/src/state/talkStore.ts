import { create } from 'zustand';
import type { Language } from '@approvals/schemas';

/** done: AI reply · partial: cut short · fallback: backup answer · error: no reply. */
export type ChatEntryState = 'streaming' | 'done' | 'partial' | 'fallback' | 'error';

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  state: ChatEntryState;
  /** Why the reply is not a normal AI reply (e.g. "The AI is slow right now"). */
  notice?: string;
  /** Friendly error shown instead of a reply. */
  error?: string;
}

interface TalkData {
  entries: ChatEntry[];
  isSending: boolean;
}

interface TalkActions {
  send: (text: string, language: Language) => Promise<void>;
  /** Asks again after a failed or backup reply. */
  retry: (language: Language) => Promise<void>;
  /** Stops a reply in progress (e.g. the view closed). */
  cancel: () => void;
  clear: () => void;
}

export const initialTalkData: TalkData = { entries: [], isSending: false };

export const useTalkStore = create<TalkData & TalkActions>()(() => ({
  ...initialTalkData,
  send: async () => {
    throw new Error('Not implemented');
  },
  retry: async () => {
    throw new Error('Not implemented');
  },
  cancel: () => {},
  clear: () => {},
}));
