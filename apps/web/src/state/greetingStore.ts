import { create } from 'zustand';
import type { Language, PartOfDay } from '@approvals/schemas';

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

export const useGreetingStore = create<GreetingData & GreetingActions>()(() => ({
  ...initialGreetingData,
  setAiWording: () => {},
  replay: async () => {},
  cancel: () => {},
}));
