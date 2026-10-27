import { create } from 'zustand';

export type ActionId = 'summary' | 'talk' | 'help' | 'teach';
export type Language = 'en' | 'hi';

interface PanelData {
  isOpen: boolean;
  isExpanded: boolean;
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

const notImplemented = () => {};

export const usePanelStore = create<PanelState>()(() => ({
  ...initialPanelData,
  open: notImplemented,
  close: notImplemented,
  toggleExpanded: notImplemented,
  openAction: notImplemented,
  back: notImplemented,
  setLanguage: notImplemented,
}));
