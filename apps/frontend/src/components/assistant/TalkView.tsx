import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { TALK_LIMITS } from '@approvals/schemas';
import { usePanelStore } from '../../state/panelStore';
import { useTalkStore } from '../../state/talkStore';
import { ChatMessages } from './ChatMessages';

const STARTERS = [
  'Which of these needs my attention first and why?',
  'What is blocking new patrol staff?',
  'What should I check in the safety specs?',
];

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
          <ChatMessages entries={entries} onRetry={() => void retry(language)} showShortcuts />
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
