import type { ActionId } from '../../state/panelStore';

export interface ActionInfo {
  id: ActionId;
  label: string;
}

export const ACTIONS: readonly ActionInfo[] = [
  { id: 'summary', label: 'Present me Summary' },
  { id: 'talk', label: 'Talk to me' },
  { id: 'help', label: 'Help me' },
  { id: 'teach', label: 'Teach me' },
];
