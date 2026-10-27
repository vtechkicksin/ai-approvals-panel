import type { ReactElement } from 'react';
import type { ActionId } from '../../state/panelStore';

/** Simple illustrations standing in for the reference panel's character art. */
const ART: Record<ActionId, { tone: string; glyph: ReactElement }> = {
  summary: {
    tone: 'violet',
    glyph: (
      <>
        <rect x="20" y="14" width="24" height="32" rx="3" />
        <path d="M26 24h12M26 30h12M26 36h8" />
      </>
    ),
  },
  talk: {
    tone: 'sky',
    glyph: (
      <>
        <path d="M14 18h24v16H24l-6 6v-6h-4z" />
        <path d="M42 26h8v14h-4v5l-5-5h-9v-4" />
      </>
    ),
  },
  help: {
    tone: 'amber',
    glyph: (
      <>
        <circle cx="32" cy="30" r="15" />
        <path d="M27 26a5 5 0 1 1 7 4.6c-1.3.6-2 1.6-2 3V35M32 40h.01" />
      </>
    ),
  },
  teach: {
    tone: 'emerald',
    glyph: (
      <>
        <path d="M12 26l20-9 20 9-20 9z" />
        <path d="M20 30v9c0 3 5 6 12 6s12-3 12-6v-9M52 26v10" />
      </>
    ),
  },
};

export function ActionArt({ action }: { action: ActionId }) {
  const { tone, glyph } = ART[action];
  return (
    <svg
      className={`action-art action-art--${tone}`}
      viewBox="0 0 64 60"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle className="action-art__bg" cx="32" cy="30" r="28" stroke="none" />
      {glyph}
    </svg>
  );
}
