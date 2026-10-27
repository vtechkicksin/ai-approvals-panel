import { useState } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { CloseIcon, CollapseIcon, ExpandIcon, InfoIcon } from '../icons';

export function PanelHeader() {
  const isExpanded = usePanelStore((s) => s.isExpanded);
  const toggleExpanded = usePanelStore((s) => s.toggleExpanded);
  const close = usePanelStore((s) => s.close);
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <header className="panel-header">
        <span className="panel-avatar" aria-hidden="true">
          ✦
        </span>
        <h2 className="panel-title">Approvals</h2>
        <div className="panel-header__actions">
          <button
            type="button"
            className="icon-button"
            aria-label="About this assistant"
            aria-expanded={showAbout}
            aria-controls="panel-about"
            onClick={() => setShowAbout((v) => !v)}
          >
            <InfoIcon />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Expand assistant"
            aria-pressed={isExpanded}
            onClick={toggleExpanded}
          >
            {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
          </button>
          <button type="button" className="icon-button" aria-label="Close assistant" onClick={close}>
            <CloseIcon />
          </button>
        </div>
      </header>
      {showAbout && (
        <p id="panel-about" className="panel-about">
          Your approvals assistant. Answers come from Claude; if the AI is slow or unavailable, you still get a
          rule-based answer.
        </p>
      )}
    </>
  );
}
