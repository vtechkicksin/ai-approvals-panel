import { create } from 'zustand';
import { textStreamEventSchema, type ChatMessage, type Language, type TextStreamEvent } from '@approvals/schemas';
import { ApiClientError, isAbort } from '../api/client';
import { streamSse } from '../api/sseClient';

/** done: AI reply · partial: cut short · fallback: backup answer · error: no reply. */
export type ChatEntryState = 'streaming' | 'done' | 'partial' | 'fallback' | 'error';

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  /** Which thread the entry belongs to (e.g. a Teach me step); undefined for a single thread. */
  scope?: number;
  content: string;
  state: ChatEntryState;
  /** Why the reply is not a normal AI reply (e.g. "The AI is slow right now"). */
  notice?: string;
  /** Friendly error shown instead of a reply. */
  error?: string;
}

interface ChatData {
  entries: ChatEntry[];
  isSending: boolean;
}

interface ChatActions {
  send: (text: string, language: Language) => Promise<void>;
  /** Asks again after a failed or backup reply in the current thread. */
  retry: (language: Language) => Promise<void>;
  /** Stops a reply in progress (e.g. the view closed). */
  cancel: () => void;
  clear: () => void;
}

export type ChatState = ChatData & ChatActions;

export const initialChatData: ChatData = { entries: [], isSending: false };

export interface ChatStoreOptions {
  /** The streaming endpoint, e.g. "/api/ai/talk". */
  path: string;
  /** The current thread; new messages join it and only its history is sent. */
  scope?: () => number | undefined;
  /** Extra request fields for a thread, e.g. { step }. */
  body?: (scope: number | undefined) => Record<string, unknown>;
}

let nextId = 0;
const newId = () => `m${++nextId}`;
const STOPPED = 'Stopped before the reply finished.';

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

/**
 * A streamed chat with friendly failure handling, shared by Talk to me and
 * Teach me: one reply at a time, history limited to real AI replies,
 * Try again for failed or backup replies, cancel on close.
 */
export function createChatStore({ path, scope = () => undefined, body = () => ({}) }: ChatStoreOptions) {
  let running: AbortController | null = null;

  return create<ChatState>()((set, get) => {
    const updateEntry = (id: string, change: (entry: ChatEntry) => ChatEntry) =>
      set((s) => ({ entries: s.entries.map((e) => (e.id === id ? change(e) : e)) }));

    /** Streams a reply into the given assistant entry, using its thread's history before it. */
    async function streamReply(replyId: string, language: Language) {
      running?.abort();
      const run = new AbortController();
      running = run;
      const entries = get().entries;
      const reply = entries.find((e) => e.id === replyId)!;
      const before = entries.slice(0, entries.indexOf(reply)).filter((e) => e.scope === reply.scope);
      set({ isSending: true });

      try {
        await streamSse({
          path,
          body: { language, messages: historyFor(before), ...body(reply.scope) },
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
          ? STOPPED
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
      ...initialChatData,

      send: async (text, language) => {
        const content = text.trim();
        if (!content || get().isSending) return;
        const thread = scope();
        const reply: ChatEntry = { id: newId(), role: 'assistant', content: '', state: 'streaming', scope: thread };
        set((s) => ({
          entries: [...s.entries, { id: newId(), role: 'user', content, state: 'done', scope: thread }, reply],
        }));
        await streamReply(reply.id, language);
      },

      retry: async (language) => {
        const thread = scope();
        const last = get().entries.filter((e) => e.scope === thread).at(-1);
        if (!last || last.role !== 'assistant' || get().isSending) return;
        if (last.state !== 'error' && last.state !== 'fallback') return;
        updateEntry(last.id, (e) => ({ id: e.id, role: e.role, scope: e.scope, content: '', state: 'streaming' }));
        await streamReply(last.id, language);
      },

      cancel: () => {
        const run = running;
        running = null;
        run?.abort();
        set((s) => ({
          isSending: false,
          entries: s.entries.map((e) =>
            e.state !== 'streaming'
              ? e
              : e.content
                ? { ...e, state: 'partial', notice: STOPPED }
                : { ...e, state: 'error', error: STOPPED },
          ),
        }));
      },

      clear: () => {
        get().cancel();
        set({ entries: [] });
      },
    };
  });
}
