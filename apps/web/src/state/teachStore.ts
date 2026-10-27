import { create } from 'zustand';
import { createChatStore } from './chatStore';

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

export const useTeachStore = create<TeachData & TeachActions>()((set) => ({
  ...initialTeachData,
  next: (stepCount) => set((s) => ({ step: Math.min(s.step + 1, stepCount + 1) })),
  previous: () => set((s) => ({ step: Math.max(1, s.step - 1) })),
  restart: () => set({ step: 1 }),
}));

/** Follow-up questions: one thread per step, and each request carries its step. */
export const useTeachChatStore = createChatStore({
  path: '/api/ai/teach',
  scope: () => useTeachStore.getState().step,
  body: (step) => ({ step }),
});
