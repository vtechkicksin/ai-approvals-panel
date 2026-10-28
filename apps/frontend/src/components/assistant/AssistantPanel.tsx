import type { KeyboardEvent } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { ChatIcon } from '../icons';
import { ActionGrid } from './ActionGrid';
import { ActionView } from './ActionView';
import { GreetingBar } from './GreetingBar';
import { GreetingCard } from './GreetingCard';
import { PanelFooter } from './PanelFooter';
import { PanelHeader } from './PanelHeader';

export function AssistantPanel() {
  const isOpen = usePanelStore((s) => s.isOpen);
  const isExpanded = usePanelStore((s) => s.isExpanded);
  const activeAction = usePanelStore((s) => s.activeAction);
  const open = usePanelStore((s) => s.open);
  const close = usePanelStore((s) => s.close);

  if (!isOpen) {
    return (
      <button type="button" className="launcher" aria-label="Open assistant" onClick={open}>
        <ChatIcon width={22} height={22} />
      </button>
    );
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };

  return (
    <section
      className="assistant-panel"
      data-expanded={isExpanded}
      aria-label="Approvals assistant"
      onKeyDown={onKeyDown}
    >
      <PanelHeader />
      <GreetingBar />
      <div className="panel-body">
        {activeAction ? (
          <ActionView action={activeAction} />
        ) : (
          <>
            <GreetingCard />
            <ActionGrid />
          </>
        )}
      </div>
      <PanelFooter />
    </section>
  );
}
