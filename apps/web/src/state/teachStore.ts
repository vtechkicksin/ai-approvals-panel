import { create } from 'zustand';

interface TeachData {
  /** 1-based step number; stepCount + 1 means the guide is finished. */
  step: number;
}

interface TeachActions {
  next: (stepCount: number) => void;
  previous: () => void;
  restart: () => void;
}

export const initialTeachData: TeachData = { step: 1 };

export const useTeachStore = create<TeachData & TeachActions>()(() => ({
  ...initialTeachData,
  next: () => {},
  previous: () => {},
  restart: () => {},
}));

/** Follow-up questions per step (placeholder until the shared chat store exists). */
export const useTeachChatStore = create<{
  entries: unknown[];
  isSending: boolean;
  send: () => Promise<void>;
  retry: () => Promise<void>;
  cancel: () => void;
  clear: () => void;
}>()(() => ({
  entries: [],
  isSending: false,
  send: async () => {
    throw new Error('Not implemented');
  },
  retry: async () => {
    throw new Error('Not implemented');
  },
  cancel: () => {},
  clear: () => {},
}));
