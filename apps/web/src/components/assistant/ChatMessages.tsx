import { usePanelStore, type ActionId } from '../../state/panelStore';
import type { ChatEntry } from '../../state/chatStore';

const SHORTCUTS: { id: Exclude<ActionId, 'talk'>; label: string }[] = [
  { id: 'summary', label: 'Present me Summary' },
  { id: 'help', label: 'Help me' },
  { id: 'teach', label: 'Teach me' },
];

function AssistantMessage({
  entry,
  isLast,
  onRetry,
  showShortcuts,
}: {
  entry: ChatEntry;
  isLast: boolean;
  onRetry: () => void;
  showShortcuts: boolean;
}) {
  const openAction = usePanelStore((s) => s.openAction);

  if (entry.state === 'error') {
    return (
      <div className="chat-msg chat-msg--assistant chat-msg--error">
        <p>{entry.error}</p>
        {isLast && (
          <button type="button" className="link-button" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="chat-msg chat-msg--assistant">
      {entry.content ? (
        <p className="chat-msg__text">{entry.content}</p>
      ) : (
        <span className="typing" aria-label="Writing a reply">
          <span />
          <span />
          <span />
        </span>
      )}
      {entry.notice && <p className="chat-msg__notice">{entry.notice}</p>}
      {entry.state === 'fallback' && (
        <div className="chat-shortcuts">
          {showShortcuts &&
            SHORTCUTS.map((s) => (
              <button key={s.id} type="button" className="chip-button" onClick={() => openAction(s.id)}>
                {s.label}
              </button>
            ))}
          {isLast && (
            <button type="button" className="link-button" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The bubbles of one chat thread (Talk to me, or one Teach me step). */
export function ChatMessages({
  entries,
  onRetry,
  showShortcuts = false,
}: {
  entries: readonly ChatEntry[];
  onRetry: () => void;
  /** Offer the other actions under a backup reply (Talk to me). */
  showShortcuts?: boolean;
}) {
  return (
    <>
      {entries.map((entry, i) =>
        entry.role === 'user' ? (
          <div key={entry.id} className="chat-msg chat-msg--user">
            <p className="chat-msg__text">{entry.content}</p>
          </div>
        ) : (
          <AssistantMessage
            key={entry.id}
            entry={entry}
            isLast={i === entries.length - 1}
            onRetry={onRetry}
            showShortcuts={showShortcuts}
          />
        ),
      )}
    </>
  );
}
