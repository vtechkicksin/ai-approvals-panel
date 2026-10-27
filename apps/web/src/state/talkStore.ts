import { create } from 'zustand';
import { textStreamEventSchema, type ChatMessage, type Language, type TextStreamEvent } from '@approvals/schemas';
import { ApiClientError, isAbort } from '../api/client';
import { streamSse } from '../api/sseClient';

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

let nextId = 0;
const newId = () => `m${++nextId}`;
let running: AbortController | null = null;

/**
 * The history sent with a request: every user message, plus only the
 * assistant replies the AI actually wrote. Backup answers and errors are
 * not part of the conversation the model should continue.
 */
export function historyFor(entries: readonly ChatEntry[]): ChatMessage[] {
  return entries.flatMap((entry): ChatMessage[] => {
    if (entry.role === 'user') return [{ role: 'user', content: entry.content }];
    if ((entry.state === 'done' || entry.state === 'partial') && entry.content.trim()) {
      return [{ role: 'assistant', content: entry.content }];
    }
    return [];
  });
}

function applyEvent(entry: ChatEntry, event: TextStreamEvent): ChatEntry {
  switch (event.type) {
    case 'token':
      return { ...entry, content: entry.content + event.text };
    case 'notice':
      return { ...entry, notice: event.message };
    case 'fallback':
      return { ...entry, content: event.text, state: 'fallback' };
    case 'done':
      return { ...entry, state: event.source === 'ai' ? 'done' : event.source === 'partial' ? 'partial' : 'fallback' };
    case 'error':
      return { ...entry, state: 'error', error: event.message };
  }
}

export const useTalkStore = create<TalkData & TalkActions>()((set, get) => {
  const updateEntry = (id: string, change: (entry: ChatEntry) => ChatEntry) =>
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? change(e) : e)) }));

  /** Streams a reply into the given assistant entry, using the history before it. */
  async function streamReply(replyId: string, language: Language) {
    running?.abort();
    const run = new AbortController();
    running = run;
    const before = get().entries.slice(
      0,
      get().entries.findIndex((e) => e.id === replyId),
    );
    set({ isSending: true });

    try {
      await streamSse({
        path: '/api/ai/talk',
        body: { language, messages: historyFor(before) },
        schema: textStreamEventSchema,
        isTerminal: (e) => e.type === 'done' || e.type === 'error',
        onEvent: (event) => {
          if (running === run) updateEntry(replyId, (entry) => applyEvent(entry, event));
        },
        signal: run.signal,
      });
    } catch (err) {
      if (running !== run) return;
      const message = isAbort(err)
        ? 'Stopped before the reply finished.'
        : err instanceof ApiClientError
          ? err.message
          : 'Something went wrong. Please try again.';
      updateEntry(replyId, (entry) => ({ ...entry, state: 'error', error: message }));
    } finally {
      if (running === run) {
        running = null;
        set({ isSending: false });
      }
    }
  }

  return {
    ...initialTalkData,

    send: async (text, language) => {
      const content = text.trim();
      if (!content || get().isSending) return;
      const reply: ChatEntry = { id: newId(), role: 'assistant', content: '', state: 'streaming' };
      set((s) => ({ entries: [...s.entries, { id: newId(), role: 'user', content, state: 'done' }, reply] }));
      await streamReply(reply.id, language);
    },

    retry: async (language) => {
      const last = get().entries.at(-1);
      if (!last || last.role !== 'assistant' || get().isSending) return;
      if (last.state !== 'error' && last.state !== 'fallback') return;
      updateEntry(last.id, (e) => ({ id: e.id, role: e.role, content: '', state: 'streaming' }));
      await streamReply(last.id, language);
    },

    cancel: () => {
      const run = running;
      running = null;
      run?.abort();
      set((s) => ({
        isSending: false,
        entries: s.entries.map((e) =>
          e.state === 'streaming'
            ? e.content
              ? { ...e, state: 'partial', notice: 'Stopped before the reply finished.' }
              : { ...e, state: 'error', error: 'Stopped before the reply finished.' }
            : e,
        ),
      }));
    },

    clear: () => {
      get().cancel();
      set({ entries: [] });
    },
  };
});
