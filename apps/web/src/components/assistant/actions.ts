import type { ActionId } from '../../state/panelStore';

export interface ActionInfo {
  id: ActionId;
  label: string;
  /** One line shown in the action view under the title. */
  blurb: string;
}

export const ACTIONS: readonly ActionInfo[] = [
  { id: 'summary', label: 'Present me Summary', blurb: 'A prioritised summary of the pending queue.' },
  { id: 'talk', label: 'Talk to me', blurb: 'Ask anything about the approvals queue.' },
  { id: 'help', label: 'Help me', blurb: 'Answers grounded in the approval policy.' },
  { id: 'teach', label: 'Teach me', blurb: 'Learn how to review an approval, step by step.' },
];
