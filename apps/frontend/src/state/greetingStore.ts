import { create } from 'zustand';
import { textStreamEventSchema, type AnswerSource, type Language, type PartOfDay } from '@approvals/schemas';
import { ApiClientError, isAbort } from '../api/client';
import { streamSse } from '../api/sseClient';

export type GreetingStatus = 'idle' | 'streaming' | 'done';

interface GreetingData {
  /** The operator's choice: let the AI word the greeting. Off by default. */
  aiWording: boolean;
  status: GreetingStatus;
  /** The AI's wording while it streams / once accepted; null means "show the template". */
  aiText: string | null;
  /** A quiet note when the AI wording was not used. */
  note: string | null;
  /** Bumped on every replay, so the view can react (e.g. read it aloud). */
  replays: number;
}

interface GreetingActions {
  setAiWording: (on: boolean) => void;
  replay: (language: Language, partOfDay: PartOfDay) => Promise<void>;
  cancel: () => void;
}

export const initialGreetingData: GreetingData = { aiWording: false, status: 'idle', aiText: null, note: null, replays: 0 };

const NOT_USED = 'AI wording unavailable, showing the standard greeting.';
let running: AbortController | null = null;

export const useGreetingStore = create<GreetingData & GreetingActions>()((set, get) => ({
  ...initialGreetingData,

  setAiWording: (on) => set({ aiWording: on, aiText: null, note: null }),

  /**
   * Shows the template again at once. With AI wording on, it then streams
   * the AI's wording over it; anything other than an accepted AI reply
   * leaves the template in place.
   */
  replay: async (language, partOfDay) => {
    running?.abort();
    running = null;
    set((s) => ({ status: 'idle', aiText: null, note: null, replays: s.replays + 1 }));
    if (!get().aiWording) return;

    const run = new AbortController();
    running = run;
    set({ status: 'streaming' });
    let text = '';
    let source: AnswerSource | undefined;

    try {
      await streamSse({
        path: '/api/ai/greeting',
        body: { language, partOfDay },
        schema: textStreamEventSchema,
        isTerminal: (e) => e.type === 'done' || e.type === 'error',
        onEvent: (event) => {
          if (running !== run) return;
          if (event.type === 'token') {
            text += event.text;
            set({ aiText: text });
          } else if (event.type === 'done') {
            source = event.source;
          }
        },
        signal: run.signal,
      });
      if (running !== run) return;
      if (source === 'ai') set({ status: 'done', aiText: text });
      else set({ status: 'done', aiText: null, note: source === 'rules' ? null : NOT_USED });
    } catch (err) {
      if (running !== run || isAbort(err)) return;
      // A rate limit says how long to wait; that is more useful than the generic note.
      const note = err instanceof ApiClientError && err.code === 'rate_limited' ? err.message : NOT_USED;
      set({ status: 'done', aiText: null, note });
    } finally {
      if (running === run) running = null;
    }
  },

  cancel: () => {
    running?.abort();
    running = null;
  },
}));
