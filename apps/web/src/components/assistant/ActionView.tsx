import { useEffect, useRef } from 'react';
import { usePanelStore, type ActionId } from '../../state/panelStore';
import { BackIcon } from '../icons';
import { ActionArt } from './ActionArt';
import { ACTIONS } from './actions';
import { SummaryView } from './SummaryView';
import { TalkView } from './TalkView';
import { HelpView } from './HelpView';

export function ActionView({ action }: { action: ActionId }) {
  const back = usePanelStore((s) => s.back);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const info = ACTIONS.find((a) => a.id === action)!;

  // Move focus into the new view so keyboard and screen-reader users follow along.
  useEffect(() => headingRef.current?.focus(), [action]);

  return (
    <div className="action-view">
      <div className="action-view__bar">
        <button type="button" className="icon-button icon-button--light" aria-label="Back to actions" onClick={back}>
          <BackIcon />
        </button>
        <h3 ref={headingRef} tabIndex={-1} className="action-view__title">
          {info.label}
        </h3>
      </div>
      {action === 'summary' ? (
        <SummaryView />
      ) : action === 'talk' ? (
        <TalkView />
      ) : action === 'help' ? (
        <HelpView />
      ) : (
        <div className="action-view__body">
          <ActionArt action={action} />
          <p className="action-view__blurb">{info.blurb}</p>
          <p className="muted">Coming next: this action will be connected to the AI.</p>
        </div>
      )}
    </div>
  );
}
