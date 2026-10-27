import { create } from 'zustand';

export type ActionId = 'summary' | 'talk' | 'help' | 'teach';
export type Language = 'en' | 'hi';

interface PanelData {
  isOpen: boolean;
  isExpanded: boolean;
  /** null = the action cards are showing. */
  activeAction: ActionId | null;
  language: Language;
}

interface PanelActions {
  open: () => void;
  close: () => void;
  toggleExpanded: () => void;
  openAction: (action: ActionId) => void;
  back: () => void;
  setLanguage: (language: Language) => void;
}

export type PanelState = PanelData & PanelActions;

export const initialPanelData: PanelData = {
  isOpen: true,
  isExpanded: false,
  activeAction: null,
  language: 'en',
};

export const usePanelStore = create<PanelState>()((set) => ({
  ...initialPanelData,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggleExpanded: () => set((s) => ({ isExpanded: !s.isExpanded })),
  openAction: (action) => set({ activeAction: action }),
  back: () => set({ activeAction: null }),
  setLanguage: (language) => set({ language }),
}));
