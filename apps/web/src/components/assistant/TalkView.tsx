import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { TALK_LIMITS } from '@approvals/schemas';
import { usePanelStore, type ActionId } from '../../state/panelStore';
import { useTalkStore, type ChatEntry } from '../../state/talkStore';

const STARTERS = [
  'Which of these needs my attention first and why?',
  'What is blocking new patrol staff?',
  'What should I check in the safety specs?',
];

const SHORTCUTS: { id: Exclude<ActionId, 'talk'>; label: string }[] = [
  { id: 'summary', label: 'Present me Summary' },
  { id: 'help', label: 'Help me' },
  { id: 'teach', label: 'Teach me' },
];

function AssistantMessage({ entry, isLast, onRetry }: { entry: ChatEntry; isLast: boolean; onRetry: () => void }) {
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
          {SHORTCUTS.map((s) => (
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

export function TalkView() {
  const language = usePanelStore((s) => s.language);
  const { entries, isSending, send, retry, cancel, clear } = useTalkStore(useShallow((s) => s));
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  // Stop a reply in progress when the view closes; the conversation itself is kept.
  useEffect(() => () => cancel(), [cancel]);

  // Keep the newest message in view as text streams in.
  const lastContent = entries.at(-1)?.content;
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [entries.length, lastContent]);

  const submit = (text: string) => {
    if (!text.trim() || isSending) return;
    setDraft('');
    void send(text, language);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(draft);
    }
  };

  return (
    <div className="talk">
      <div ref={logRef} className="talk-log" role="log" aria-label="Conversation" aria-live="polite">
        {entries.length === 0 ? (
          <div className="talk-empty">
            <p className="muted">Ask anything about the approvals queue. Try:</p>
            {STARTERS.map((q) => (
              <button key={q} type="button" className="chip-button" onClick={() => submit(q)}>
                {q}
              </button>
            ))}
          </div>
        ) : (
          entries.map((entry, i) =>
            entry.role === 'user' ? (
              <div key={entry.id} className="chat-msg chat-msg--user">
                <p className="chat-msg__text">{entry.content}</p>
              </div>
            ) : (
              <AssistantMessage
                key={entry.id}
                entry={entry}
                isLast={i === entries.length - 1}
                onRetry={() => void retry(language)}
              />
            ),
          )
        )}
      </div>

      <form className="talk-composer" onSubmit={onSubmit}>
        <textarea
          aria-label="Message"
          placeholder="Ask about the approvals queue…"
          rows={2}
          maxLength={TALK_LIMITS.userMessage}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="talk-composer__actions">
          {entries.length > 0 && (
            <button type="button" className="link-button" onClick={clear}>
              Clear conversation
            </button>
          )}
          <button type="submit" className="button" disabled={isSending || !draft.trim()}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
